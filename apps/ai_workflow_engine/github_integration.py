# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: apps/ai_workflow_engine/github_integration.py                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
"""
GitHub Apps and Actions Integration for AI Workflow Engine
Handles webhook processing, workflow dispatch, and status updates
"""

import os
import json
import hmac
import hashlib
import asyncio
import aiohttp
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from flask import Flask, request, jsonify
import logging

@dataclass
class GitHubEvent:
    """GitHub webhook event"""
    event_type: str
    action: str
    repository: Dict[str, Any]
    sender: Dict[str, Any]
    payload: Dict[str, Any]
    timestamp: datetime

@dataclass
class WorkflowDispatch:
    """GitHub Actions workflow dispatch"""
    repository: str
    workflow_id: str
    ref: str
    inputs: Dict[str, str]

class GitHubAppsIntegration:
    """GitHub Apps integration for workflow automation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.app_id = config.get('app_id')
        self.private_key = config.get('private_key')
        self.webhook_secret = config.get('webhook_secret')
        self.installation_id = config.get('installation_id')
        self.access_token_cache = {}
        
        # Flask app for webhook handling
        self.app = Flask(__name__)
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup Flask routes for GitHub webhooks"""
        
        @self.app.route('/webhook/github', methods=['POST'])
        def handle_webhook():
            """Handle GitHub webhook events"""
            try:
                # Verify webhook signature
                if not self._verify_webhook_signature(request):
                    return jsonify({'error': 'Invalid signature'}), 401
                
                # Parse event
                event = self._parse_webhook_event(request)
                
                # Handle event asynchronously
                asyncio.create_task(self._handle_github_event(event))
                
                return jsonify({'status': 'received'}), 200
                
            except Exception as e:
                self.logger.error(f"Webhook error: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/github/status/<repo>/<sha>', methods=['GET'])
        def get_commit_status(repo: str, sha: str):
            """Get commit status"""
            try:
                status = asyncio.run(self._get_commit_status(repo, sha))
                return jsonify(status), 200
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            """Health check endpoint"""
            return jsonify({'status': 'healthy', 'service': 'github-apps'}), 200
    
    def _verify_webhook_signature(self, request) -> bool:
        """Verify GitHub webhook signature"""
        if not self.webhook_secret:
            return True
        
        signature = request.headers.get('X-Hub-Signature-256')
        if not signature:
            return False
        
        # Calculate expected signature
        expected = hmac.new(
            self.webhook_secret.encode(),
            request.data,
            hashlib.sha256
        ).hexdigest()
        
        expected_signature = f"sha256={expected}"
        
        return hmac.compare_digest(signature, expected_signature)
    
    def _parse_webhook_event(self, request) -> GitHubEvent:
        """Parse GitHub webhook event"""
        event_type = request.headers.get('X-GitHub-Event')
        payload = request.get_json()
        
        return GitHubEvent(
            event_type=event_type,
            action=payload.get('action'),
            repository=payload.get('repository', {}),
            sender=payload.get('sender', {}),
            payload=payload,
            timestamp=datetime.now()
        )
    
    async def _handle_github_event(self, event: GitHubEvent):
        """Handle GitHub webhook event"""
        self.logger.info(f"Handling GitHub event: {event.event_type}.{event.action}")
        
        if event.event_type == 'push':
            await self._handle_push_event(event)
        elif event.event_type == 'pull_request':
            await self._handle_pull_request_event(event)
        elif event.event_type == 'workflow_dispatch':
            await self._handle_workflow_dispatch(event)
        elif event.event_type == 'check_run':
            await self._handle_check_run_event(event)
    
    async def _handle_push_event(self, event: GitHubEvent):
        """Handle push event - trigger workflows"""
        repo_name = event.repository['full_name']
        branch = event.payload['ref'].replace('refs/heads/', '')
        commit = event.payload['after']
        
        # Check if there are workflow files that should be triggered
        workflows_to_trigger = await self._get_workflows_for_push(repo_name, branch, commit)
        
        for workflow in workflows_to_trigger:
            await self._trigger_workflow_dispatch(
                repository=repo_name,
                workflow_id=workflow['id'],
                ref=branch,
                inputs={
                    'event_type': 'push',
                    'branch': branch,
                    'commit': commit,
                    'triggered_by': 'ai_workflow_engine'
                }
            )
    
    async def _handle_pull_request_event(self, event: GitHubEvent):
        """Handle pull request event"""
        if event.action in ['opened', 'synchronize', 'reopened']:
            repo_name = event.repository['full_name']
            pr_number = event.payload['pull_request']['number']
            head_sha = event.payload['pull_request']['head']['sha']
            
            # Trigger PR workflows
            await self._trigger_workflow_dispatch(
                repository=repo_name,
                workflow_id='pr-check.yml',
                ref=head_sha,
                inputs={
                    'event_type': 'pull_request',
                    'pr_number': str(pr_number),
                    'head_sha': head_sha,
                    'triggered_by': 'ai_workflow_engine'
                }
            )
    
    async def _handle_workflow_dispatch(self, event: GitHubEvent):
        """Handle manual workflow dispatch"""
        # This is for manually triggered workflows
        pass
    
    async def _handle_check_run_event(self, event: GitHubEvent):
        """Handle check run events for status updates"""
        if event.action == 'completed':
            repo_name = event.repository['full_name']
            check_run = event.payload['check_run']
            head_sha = check_run['head_sha']
            status = 'completed' if check_run['conclusion'] == 'success' else 'failed'
            
            # Update workflow engine status
            await self._update_workflow_status(repo_name, head_sha, status, check_run)
    
    async def _get_workflows_for_push(self, repo_name: str, branch: str, commit: str) -> List[Dict[str, Any]]:
        """Get workflows that should be triggered for a push"""
        # Get changed files in the commit
        changed_files = await self._get_changed_files(repo_name, commit)
        
        # Determine which workflows to trigger based on changed files
        workflows = []
        
        # Always trigger main CI workflow
        workflows.append({'id': 'ci.yml', 'name': 'Continuous Integration'})
        
        # Trigger specific workflows based on file changes
        if any(f.startswith('apps/ai_workflow_engine/') for f in changed_files):
            workflows.append({'id': 'workflow-engine-deploy.yml', 'name': 'Workflow Engine Deployment'})
        
        if any(f.endswith('.py') for f in changed_files):
            workflows.append({'id': 'python-tests.yml', 'name': 'Python Tests'})
        
        if any(f.startswith('infrastructure/') for f in changed_files):
            workflows.append({'id': 'infrastructure-deploy.yml', 'name': 'Infrastructure Deployment'})
        
        return workflows
    
    async def _get_changed_files(self, repo_name: str, commit: str) -> List[str]:
        """Get list of changed files in a commit"""
        token = await self._get_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            url = f'https://api.github.com/repos/{repo_name}/commits/{commit}'
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    return []
                
                commit_data = await response.json()
                files = commit_data.get('files', [])
                return [f['filename'] for f in files]
    
    async def _trigger_workflow_dispatch(self, repository: str, workflow_id: str, ref: str, inputs: Dict[str, str]):
        """Trigger GitHub Actions workflow dispatch"""
        token = await self._get_access_token()
        
        dispatch_data = {
            'ref': ref,
            'inputs': inputs
        }
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            url = f'https://api.github.com/repos/{repository}/actions/workflows/{workflow_id}/dispatches'
            async with session.post(url, headers=headers, json=dispatch_data) as response:
                if response.status == 204:
                    self.logger.info(f"Triggered workflow {workflow_id} for {repository}")
                else:
                    error_text = await response.text()
                    self.logger.error(f"Failed to trigger workflow: {response.status} - {error_text}")
    
    async def _get_access_token(self) -> str:
        """Get GitHub access token using app authentication"""
        # Check cache first
        cache_key = f"{self.app_id}_{self.installation_id}"
        if cache_key in self.access_token_cache:
            token_data = self.access_token_cache[cache_key]
            if datetime.now() < token_data['expires_at']:
                return token_data['token']
        
        # Generate JWT
        jwt_token = self._generate_jwt()
        
        # Get installation access token
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {jwt_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            url = f'https://api.github.com/app/installations/{self.installation_id}/access_tokens'
            async with session.post(url, headers=headers) as response:
                if response.status != 201:
                    raise Exception(f"Failed to get access token: {response.status}")
                
                token_data = await response.json()
                
                # Cache token
                self.access_token_cache[cache_key] = {
                    'token': token_data['token'],
                    'expires_at': datetime.fromisoformat(token_data['expires_at'].replace('Z', '+00:00'))
                }
                
                return token_data['token']
    
    def _generate_jwt(self) -> str:
        """Generate JWT for GitHub App authentication"""
        import jwt
        import time
        
        now = int(time.time())
        payload = {
            'iat': now - 60,  # Issued 1 minute ago
            'exp': now + 600,  # Expires in 10 minutes
            'iss': self.app_id
        }
        
        return jwt.encode(payload, self.private_key, algorithm='RS256')
    
    async def _get_commit_status(self, repo: str, sha: str) -> Dict[str, Any]:
        """Get combined status for a commit"""
        token = await self._get_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            url = f'https://api.github.com/repos/{repo}/commits/{sha}/status'
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    return {'error': 'Failed to get status'}
                
                return await response.json()
    
    async def _update_workflow_status(self, repo: str, sha: str, status: str, details: Dict[str, Any]):
        """Update workflow status (this would integrate with the workflow engine)"""
        # This would update the AI workflow engine with the GitHub status
        self.logger.info(f"Updating workflow status for {repo}/{sha}: {status}")
        
        # Store status in workflow engine or external storage
        pass
    
    async def create_check_run(self, repo: str, head_sha: str, name: str, status: str = 'queued', **kwargs):
        """Create a GitHub check run"""
        token = await self._get_access_token()
        
        check_data = {
            'name': name,
            'head_sha': head_sha,
            'status': status,
            **kwargs
        }
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            url = f'https://api.github.com/repos/{repo}/check-runs'
            async with session.post(url, headers=headers, json=check_data) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Failed to create check run: {response.status} - {error_text}")
                
                return await response.json()
    
    async def update_check_run(self, repo: str, check_run_id: int, **kwargs):
        """Update a GitHub check run"""
        token = await self._get_access_token()
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            url = f'https://api.github.com/repos/{repo}/check-runs/{check_run_id}'
            async with session.patch(url, headers=headers, json=kwargs) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Failed to update check run: {response.status} - {error_text}")
                
                return await response.json()

# GitHub Actions workflow templates
GITHUB_ACTIONS_WORKFLOWS = {
    'ci.yml': {
        'name': 'Continuous Integration',
        'on': {
            'push': {'branches': ['main', 'develop']},
            'pull_request': {'branches': ['main']}
        },
        'jobs': {
            'test': {
                'runs-on': 'ubuntu-latest',
                'strategy': {
                    'matrix': {
                        'python-version': ['3.9', '3.10', '3.11']
                    }
                },
                'steps': [
                    {'uses': 'actions/checkout@v3'},
                    {
                        'name': 'Set up Python',
                        'uses': 'actions/setup-python@v4',
                        'with': {'python-version': '${{ matrix.python-version }}'}
                    },
                    {
                        'name': 'Install dependencies',
                        'run': 'pip install -r requirements.txt'
                    },
                    {
                        'name': 'Run tests',
                        'run': 'pytest tests/ -v --cov=.'
                    },
                    {
                        'name': 'Upload coverage',
                        'uses': 'codecov/codecov-action@v3'
                    }
                ]
            }
        }
    },
    
    'workflow-engine-deploy.yml': {
        'name': 'Deploy AI Workflow Engine',
        'on': {
            'push': {'paths': ['apps/ai_workflow_engine/**'], 'branches': ['main']},
            'workflow_dispatch': {
                'inputs': {
                    'environment': {'required': False, 'default': 'production'},
                    'version': {'required': False, 'default': 'latest'}
                }
            }
        },
        'jobs': {
            'deploy': {
                'runs-on': 'ubuntu-latest',
                'steps': [
                    {'uses': 'actions/checkout@v3'},
                    {
                        'name': 'Setup Docker Buildx',
                        'uses': 'docker/setup-buildx-action@v2'
                    },
                    {
                        'name': 'Login to Container Registry',
                        'uses': 'docker/login-action@v2',
                        'with': {
                            'registry': 'ghcr.io',
                            'username': '${{ github.actor }}',
                            'password': '${{ secrets.GITHUB_TOKEN }}'
                        }
                    },
                    {
                        'name': 'Build and push',
                        'uses': 'docker/build-push-action@v4',
                        'with': {
                            'context': './apps/ai_workflow_engine',
                            'push': True,
                            'tags': 'ghcr.io/heady-systems/ai-workflow-engine:latest',
                            'cache-from': 'type=gha',
                            'cache-to': 'type=gha,mode=max'
                        }
                    },
                    {
                        'name': 'Deploy to Render',
                        'run': 'curl -X POST -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" -H "Content-Type: application/json" -d \'{"serviceId": "${{ secrets.RENDER_SERVICE_ID }}", "imageUrl": "ghcr.io/heady-systems/ai-workflow-engine:latest"}\' https://api.render.com/v1/services/deploys'
                    }
                ]
            }
        }
    },
    
    'pr-check.yml': {
        'name': 'PR Check',
        'on': {
            'pull_request': {
                'types': ['opened', 'synchronize', 'reopened']
            }
        },
        'jobs': {
            'pr-validation': {
                'runs-on': 'ubuntu-latest',
                'steps': [
                    {'uses': 'actions/checkout@v3'},
                    {
                        'name': 'Validate workflow definitions',
                        'run': 'python -m py_compile apps/ai_workflow_engine/**/*.py && echo "Workflow validation passed"'
                    },
                    {
                        'name': 'Security scan',
                        'uses': 'securecodewarrior/github-action-add-sarif@v1',
                        'with': {
                            'sarif-file': 'security-scan-results.sarif'
                        }
                    }
                ]
            }
        }
    }
}

if __name__ == "__main__":
    # Example usage
    config = {
        'app_id': os.getenv('GITHUB_APP_ID'),
        'private_key': os.getenv('GITHUB_PRIVATE_KEY'),
        'webhook_secret': os.getenv('GITHUB_WEBHOOK_SECRET'),
        'installation_id': os.getenv('GITHUB_INSTALLATION_ID')
    }
    
    github_integration = GitHubAppsIntegration(config)
    
    # Start Flask app
    app = github_integration.app
    app.run(host='0.0.0.0', port=8081, debug=True)
