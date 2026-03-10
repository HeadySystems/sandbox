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
# ║  FILE: apps/ai_workflow_engine/cloudflare_integration.py                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
"""
Cloudflare Workers Integration for AI Workflow Engine
Handles worker deployment, KV storage, and D1 database operations
"""

import os
import json
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class WorkerConfig:
    """Cloudflare Worker configuration"""
    name: str
    script_content: str
    bindings: Dict[str, Any]
    environment: Dict[str, str]
    kv_namespaces: List[str]
    d1_databases: List[str]
    routes: List[str]

@dataclass
class WorkerDeployment:
    """Worker deployment information"""
    worker_id: str
    name: str
    url: str
    created_at: datetime
    updated_at: datetime
    status: str

class CloudflareWorkersIntegration:
    """Cloudflare Workers integration for workflow execution"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.api_token = config.get('api_token')
        self.account_id = config.get('account_id')
        self.zone_id = config.get('zone_id')
        self.logger = logging.getLogger(__name__)
        
        # Base API URLs
        self.base_url = f'https://api.cloudflare.com/client/v4/accounts/{self.account_id}'
        self.workers_url = f'{self.base_url}/workers/scripts'
        self.kv_url = f'{self.base_url}/storage/kv/namespaces'
        self.d1_url = f'{self.base_url}/d1/database'
    
    async def deploy_workflow_worker(self, workflow_id: str, workflow_config: Dict[str, Any]) -> WorkerDeployment:
        """Deploy a workflow as a Cloudflare Worker"""
        
        # Generate worker script
        worker_script = self._generate_workflow_script(workflow_id, workflow_config)
        
        # Create worker configuration
        worker_config = WorkerConfig(
            name=f'workflow-{workflow_id}',
            script_content=worker_script,
            bindings={
                'WORKFLOW_ID': workflow_id,
                'KV_NAMESPACE': f'workflow_{workflow_id}',
                'D1_DATABASE': f'workflow_db_{workflow_id}'
            },
            environment=workflow_config.get('environment', {}),
            kv_namespaces=[f'workflow_{workflow_id}'],
            d1_databases=[f'workflow_db_{workflow_id}'],
            routes=[f'/api/workflows/{workflow_id}/*']
        )
        
        # Deploy worker
        deployment = await self._deploy_worker(worker_config)
        
        # Setup KV namespace
        await self._setup_kv_namespace(worker_config.kv_namespaces[0])
        
        # Setup D1 database
        await self._setup_d1_database(worker_config.d1_databases[0])
        
        # Configure routes
        await self._configure_routes(deployment.worker_id, worker_config.routes)
        
        return deployment
    
    def _generate_workflow_script(self, workflow_id: str, workflow_config: Dict[str, Any]) -> str:
        """Generate Cloudflare Worker script for workflow execution"""
        
        steps = workflow_config.get('steps', [])
        environment = workflow_config.get('environment', {})
        
        script_template = f'''
// AI Workflow Engine Worker - {workflow_id}
// Generated at {datetime.now().isoformat()}

export default {{
  async fetch(request, env, ctx) {{
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Handle different workflow endpoints
    if (path === '/api/workflows/{workflow_id}/execute' && method === 'POST') {{
      return await handleWorkflowExecution(request, env, ctx);
    }}
    
    if (path === '/api/workflows/{workflow_id}/status' && method === 'GET') {{
      return await handleWorkflowStatus(request, env, ctx);
    }}
    
    if (path === '/api/workflows/{workflow_id}/logs' && method === 'GET') {{
      return await handleWorkflowLogs(request, env, ctx);
    }}
    
    if (path === '/api/workflows/{workflow_id}/cancel' && method === 'POST') {{
      return await handleWorkflowCancellation(request, env, ctx);
    }}
    
    return new Response('Not Found', {{ status: 404 }});
  }}
}};

async function handleWorkflowExecution(request, env, ctx) {{
  try {{
    const body = await request.json();
    const executionId = generateExecutionId();
    
    // Store execution in KV
    const executionData = {{
      id: executionId,
      workflowId: '{workflow_id}',
      status: 'running',
      startedAt: new Date().toISOString(),
      inputs: body.inputs || {{}},
      steps: {json.dumps([step.get('id') for step in steps], indent=8)}
    }};
    
    await env.WORKFLOW_KV.put(`execution:${{executionId}}`, JSON.stringify(executionData));
    
    // Execute workflow steps
    ctx.waitUntil(executeWorkflowSteps(executionId, body.inputs || {{}}, env));
    
    return new Response(JSON.stringify({{
      executionId: executionId,
      status: 'started',
      message: 'Workflow execution started'
    }}), {{
      headers: {{ 'Content-Type': 'application/json' }}
    }});
    
  }} catch (error) {{
    console.error('Workflow execution error:', error);
    return new Response(JSON.stringify({{
      error: 'Failed to start workflow execution',
      details: error.message
    }}), {{
      status: 500,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
}}

async function executeWorkflowSteps(executionId, inputs, env) {{
  const steps = {json.dumps(steps, indent=6)};
  
  for (const step of steps) {{
    try {{
      await executeStep(executionId, step, inputs, env);
    }} catch (error) {{
      console.error(`Step ${{step.id}} failed:`, error);
      await updateStepStatus(executionId, step.id, 'failed', error.message);
      break;
    }}
  }}
  
  // Mark execution as completed
  await updateExecutionStatus(executionId, 'completed');
}}

async function executeStep(executionId, step, inputs, env) {{
  const startTime = Date.now();
  await updateStepStatus(executionId, step.id, 'running');
  
  try {{
    // Execute step based on type
    const result = await executeStepCommand(step, inputs, env);
    
    const duration = Date.now() - startTime;
    await updateStepStatus(executionId, step.id, 'completed', null, result, duration);
    
  }} catch (error) {{
    const duration = Date.now() - startTime;
    await updateStepStatus(executionId, step.id, 'failed', error.message, null, duration);
    throw error;
  }}
}}

async function executeStepCommand(step, inputs, env) {{
  const {{ command, deployment_target }} = step;
  
  if (deployment_target === 'cloudflare_workers') {{
    return await executeCloudflareWorkerStep(step, inputs, env);
  }} else if (deployment_target === 'github_actions') {{
    return await executeGitHubActionsStep(step, inputs, env);
  }} else if (deployment_target === 'render') {{
    return await executeRenderStep(step, inputs, env);
  }} else {{
    return await executeLocalStep(step, inputs, env);
  }}
}}

async function executeCloudflareWorkerStep(step, inputs, env) {{
  // Execute step directly in the worker
  const {{ command, environment }} = step;
  
  // Merge environment variables
  const envVars = {{ ...{json.dumps(environment, indent=6)}, ...inputs }};
  
  // Simple command execution (in real implementation, this would be more sophisticated)
  if (command.includes('python')) {{
    return {{ output: 'Python execution simulated', logs: ['Python step executed'] }};
  }} else if (command.includes('npm')) {{
    return {{ output: 'NPM execution simulated', logs: ['NPM step executed'] }};
  }} else {{
    return {{ output: `Executed: ${{command}}`, logs: [`Command executed: ${{command}}`] }};
  }}
}}

async function executeGitHubActionsStep(step, inputs, env) {{
  // Trigger GitHub Actions workflow
  const response = await fetch('https://api.github.com/repos/heady-systems/ai-workflow-engine/actions/workflows/deploy.yml/dispatches', {{
    method: 'POST',
    headers: {{
      'Authorization': `token ${{env.GITHUB_TOKEN}}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }},
    body: JSON.stringify({{
      ref: 'main',
      inputs: {{
        command: step.command,
        step_id: step.id,
        environment: JSON.stringify(step.environment || {{}}),
        inputs: JSON.stringify(inputs)
      }}
    }})
  }});
  
  if (response.ok) {{
    return {{ output: 'GitHub Actions workflow triggered', logs: ['Workflow dispatched to GitHub Actions'] }};
  }} else {{
    throw new Error(`Failed to trigger GitHub Actions: ${{response.status}}`);
  }}
}}

async function executeRenderStep(step, inputs, env) {{
  // Deploy to Render service
  const response = await fetch('https://api.render.com/v1/services', {{
    method: 'POST',
    headers: {{
      'Authorization': `Bearer ${{env.RENDER_API_KEY}}`,
      'Content-Type': 'application/json'
    }},
    body: JSON.stringify({{
      service: {{
        name: `workflow-step-${{step.id}}`,
        type: 'private_service',
        env: step.environment || {{}},
        buildCommand: step.command,
        startCommand: 'echo "Step completed"'
      }}
    }})
  }});
  
  if (response.ok) {{
    return {{ output: 'Render service created', logs: ['Service deployed to Render'] }};
  }} else {{
    throw new Error(`Failed to create Render service: ${{response.status}}`);
  }}
}}

async function executeLocalStep(step, inputs, env) {{
  // Simulate local execution
  return {{ output: `Local execution: ${{step.command}}`, logs: [`Executed locally: ${{step.command}}`] }};
}}

async function handleWorkflowStatus(request, env, ctx) {{
  const url = new URL(request.url);
  const executionId = url.searchParams.get('execution_id');
  
  if (!executionId) {{
    return new Response(JSON.stringify({{ error: 'execution_id required' }}), {{
      status: 400,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
  
  try {{
    const executionData = await env.WORKFLOW_KV.get(`execution:${{executionId}}`);
    
    if (!executionData) {{
      return new Response(JSON.stringify({{ error: 'Execution not found' }}), {{
        status: 404,
        headers: {{ 'Content-Type': 'application/json' }}
      }});
    }}
    
    const execution = JSON.parse(executionData);
    return new Response(JSON.stringify(execution), {{
      headers: {{ 'Content-Type': 'application/json' }}
    }});
    
  }} catch (error) {{
    return new Response(JSON.stringify({{ error: 'Failed to get execution status' }}), {{
      status: 500,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
}}

async function handleWorkflowLogs(request, env, ctx) {{
  const url = new URL(request.url);
  const executionId = url.searchParams.get('execution_id');
  
  if (!executionId) {{
    return new Response(JSON.stringify({{ error: 'execution_id required' }}), {{
      status: 400,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
  
  try {{
    const logs = await env.WORKFLOW_KV.get(`logs:${{executionId}}`);
    
    return new Response(logs || '[]', {{
      headers: {{ 'Content-Type': 'application/json' }}
    }});
    
  }} catch (error) {{
    return new Response(JSON.stringify({{ error: 'Failed to get logs' }}), {{
      status: 500,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
}}

async function handleWorkflowCancellation(request, env, ctx) {{
  const url = new URL(request.url);
  const executionId = url.searchParams.get('execution_id');
  
  if (!executionId) {{
    return new Response(JSON.stringify({{ error: 'execution_id required' }}), {{
      status: 400,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
  
  try {{
    await updateExecutionStatus(executionId, 'cancelled');
    
    return new Response(JSON.stringify({{
      executionId: executionId,
      status: 'cancelled',
      message: 'Workflow execution cancelled'
    }}), {{
      headers: {{ 'Content-Type': 'application/json' }}
    }});
    
  }} catch (error) {{
    return new Response(JSON.stringify({{ error: 'Failed to cancel workflow' }}), {{
      status: 500,
      headers: {{ 'Content-Type': 'application/json' }}
    }});
  }}
}}

// Helper functions
function generateExecutionId() {{
  return `exec_${{Date.now()}}_${{Math.random().toString(36).substr(2, 9)}}`;
}}

async function updateExecutionStatus(executionId, status, error = null) {{
  // This would update the execution status in KV
  console.log(`Updating execution ${{executionId}} status to ${{status}}`);
}}

async function updateStepStatus(executionId, stepId, status, error = null, result = null, duration = null) {{
  const stepUpdate = {{
    executionId: executionId,
    stepId: stepId,
    status: status,
    timestamp: new Date().toISOString(),
    error: error,
    result: result,
    duration: duration
  }};
  
  // Store step update in KV
  console.log(`Step ${{stepId}} in execution ${{executionId}}: ${{status}}`);
}}
'''
        
        return script_template
    
    async def _deploy_worker(self, worker_config: WorkerConfig) -> WorkerDeployment:
        """Deploy worker to Cloudflare"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/javascript'
            }
            
            # Upload worker script
            worker_url = f'{self.workers_url}/{worker_config.name}'
            
            async with session.put(worker_url, headers=headers, data=worker_config.script_content) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Failed to deploy worker: {response.status} - {error_text}")
                
                worker_data = await response.json()
                
                return WorkerDeployment(
                    worker_id=worker_data.get('id', worker_config.name),
                    name=worker_config.name,
                    url=f"https://{worker_config.name}.{self.account_id}.workers.dev",
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    status='deployed'
                )
    
    async def _setup_kv_namespace(self, namespace_name: str):
        """Setup KV namespace for workflow"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            # Create namespace
            namespace_data = {
                'title': f'KV Namespace for {namespace_name}'
            }
            
            async with session.post(self.kv_url, headers=headers, json=namespace_data) as response:
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    self.logger.warning(f"KV namespace might already exist: {error_text}")
                
                return await response.json() if response.status in [200, 201] else None
    
    async def _setup_d1_database(self, database_name: str):
        """Setup D1 database for workflow"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            # Create database
            database_data = {
                'name': database_name,
                'schema': self._get_workflow_database_schema()
            }
            
            async with session.post(self.d1_url, headers=headers, json=database_data) as response:
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    self.logger.warning(f"D1 database might already exist: {error_text}")
                
                return await response.json() if response.status in [200, 201] else None
    
    def _get_workflow_database_schema(self) -> str:
        """Get D1 database schema for workflow data"""
        return """
        CREATE TABLE IF NOT EXISTS executions (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            inputs TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS step_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            execution_id TEXT NOT NULL,
            step_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            result TEXT,
            error_message TEXT,
            duration_ms INTEGER,
            FOREIGN KEY (execution_id) REFERENCES executions(id)
        );
        
        CREATE TABLE IF NOT EXISTS workflow_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            execution_id TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (execution_id) REFERENCES executions(id)
        );
        """
    
    async def _configure_routes(self, worker_id: str, routes: List[str]):
        """Configure routes for worker"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            for route in routes:
                route_data = {
                    'pattern': route,
                    'script_name': worker_id
                }
                
                routes_url = f'{self.base_url}/workers/routes'
                async with session.post(routes_url, headers=headers, json=route_data) as response:
                    if response.status not in [200, 201]:
                        error_text = await response.text()
                        self.logger.warning(f"Failed to configure route {route}: {error_text}")
    
    async def update_execution_status(self, status_data: Dict[str, Any]):
        """Update execution status in Cloudflare KV"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            # Store in KV namespace
            execution_id = status_data.get('execution_id')
            
            kv_url = f'{self.kv_url}/workflow_{status_data.get("workflow_id", "default")}/values/execution_{execution_id}'
            
            async with session.put(kv_url, headers=headers, json=status_data) as response:
                if response.status != 200:
                    error_text = await response.text()
                    self.logger.error(f"Failed to update execution status: {error_text}")
    
    async def get_worker_metrics(self, worker_name: str) -> Dict[str, Any]:
        """Get metrics for a specific worker"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            # Get worker analytics
            analytics_url = f'{self.workers_url}/{worker_name}/analytics'
            
            async with session.get(analytics_url, headers=headers) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {'error': 'Failed to get metrics'}
    
    async def list_workers(self) -> List[Dict[str, Any]]:
        """List all deployed workers"""
        
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
            
            async with session.get(self.workers_url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('result', [])
                else:
                    return []

# Cloudflare Worker templates for different workflow types
WORKER_TEMPLATES = {
    'ai-model-training': {
        'description': 'AI Model Training Workflow Worker',
        'bindings': {
            'MODEL_STORAGE': 'r2://models',
            'TRAINING_DATA': 'r2://training-data',
            'GPU_ACCELERATOR': 'true'
        },
        'environment': {
            'PYTHON_VERSION': '3.10',
            'FRAMEWORK': 'pytorch',
            'ACCELERATION': 'gpu'
        }
    },
    
    'data-processing': {
        'description': 'Data Processing Workflow Worker',
        'bindings': {
            'DATA_INPUT': 'r2://input-data',
            'DATA_OUTPUT': 'r2://processed-data',
            'TEMP_STORAGE': 'r2://temp'
        },
        'environment': {
            'PROCESSING_TYPE': 'batch',
            'CHUNK_SIZE': '1000'
        }
    },
    
    'web-deployment': {
        'description': 'Web Application Deployment Worker',
        'bindings': {
            'DEPLOY_TARGET': 'pages',
            'DOMAIN': 'heady-systems.com'
        },
        'environment': {
            'BUILD_TOOL': 'webpack',
            'DEPLOY_ENV': 'production'
        }
    }
}

if __name__ == "__main__":
    # Example usage
    config = {
        'api_token': os.getenv('CLOUDFLARE_API_TOKEN'),
        'account_id': os.getenv('CLOUDFLARE_ACCOUNT_ID'),
        'zone_id': os.getenv('CLOUDFLARE_ZONE_ID')
    }
    
    cloudflare_integration = CloudflareWorkersIntegration(config)
    
    async def deploy_example_workflow():
        workflow_config = {
            'id': 'example-workflow',
            'name': 'Example AI Workflow',
            'steps': [
                {
                    'id': 'data-prep',
                    'name': 'Data Preparation',
                    'command': 'python prepare_data.py',
                    'deployment_target': 'cloudflare_workers',
                    'environment': {'DATA_PATH': '/data/input'}
                },
                {
                    'id': 'model-training',
                    'name': 'Model Training',
                    'command': 'python train_model.py',
                    'deployment_target': 'render',
                    'environment': {'GPU': 'true'}
                }
            ],
            'environment': {'WORKFLOW_TYPE': 'ai-training'}
        }
        
        deployment = await cloudflare_integration.deploy_workflow_worker(
            workflow_config['id'], 
            workflow_config
        )
        
        print(f"Deployed worker: {deployment.name} at {deployment.url}")
    
    asyncio.run(deploy_example_workflow())
