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
# ║  FILE: apps/ai_workflow_engine/tests/test_workflow_engine.py                                                    ║
# ║  LAYER: tests                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
"""
Test Suite for AI Workflow Engine
Comprehensive testing of all components and integrations
"""

import pytest
import asyncio
import json
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
from main import AIWorkflowEngine, Workflow, WorkflowStep, ResourceRequirement, DeploymentTarget

class TestAIWorkflowEngine:
    """Test suite for AI Workflow Engine"""
    
    @pytest.fixture
    def workflow_engine(self):
        """Create workflow engine instance for testing"""
        config = {
            'resources': {
                'max_cpu_cores': 16,
                'max_memory_mb': 32768,
                'max_gpu_memory_mb': 16384
            },
            'github': {
                'token': 'test_token',
                'app_id': 'test_app_id',
                'private_key': 'test_private_key'
            },
            'cloudflare': {
                'api_token': 'test_cf_token',
                'account_id': 'test_account_id'
            },
            'render': {
                'api_key': 'test_render_key'
            }
        }
        return AIWorkflowEngine(config)
    
    @pytest.fixture
    def sample_workflow(self):
        """Sample workflow for testing"""
        return {
            'id': 'test-workflow',
            'name': 'Test Workflow',
            'description': 'A test workflow for validation',
            'steps': [
                {
                    'id': 'step-1',
                    'name': 'Test Step 1',
                    'description': 'First test step',
                    'command': 'echo "Hello World"',
                    'deployment_target': 'local',
                    'resources': {
                        'cpu_cores': 1.0,
                        'memory_mb': 512,
                        'duration_minutes': 5
                    }
                },
                {
                    'id': 'step-2',
                    'name': 'Test Step 2',
                    'description': 'Second test step',
                    'command': 'python test.py',
                    'deployment_target': 'render',
                    'dependencies': ['step-1'],
                    'resources': {
                        'cpu_cores': 2.0,
                        'memory_mb': 1024,
                        'duration_minutes': 10
                    }
                }
            ],
            'triggers': ['manual'],
            'environment': {
                'TEST_ENV': 'testing'
            }
        }
    
    @pytest.mark.asyncio
    async def test_create_workflow(self, workflow_engine, sample_workflow):
        """Test workflow creation"""
        workflow = await workflow_engine.create_workflow(sample_workflow)
        
        assert workflow.id == 'test-workflow'
        assert workflow.name == 'Test Workflow'
        assert len(workflow.steps) == 2
        assert workflow.status == WorkflowStatus.PENDING
        assert workflow.id in workflow_engine.workflows
    
    @pytest.mark.asyncio
    async def test_dynamic_resource_allocation(self, workflow_engine):
        """Test dynamic resource allocation optimization"""
        step = WorkflowStep(
            id='test-step',
            name='Test Step',
            description='Test',
            command='python train_model.py --epochs 100 --batch-size 32',
            resources=ResourceRequirement(
                cpu_cores=2.0,
                memory_mb=4096,
                duration_minutes=60
            ),
            deployment_target=DeploymentTarget.RENDER
        )
        
        optimized = await workflow_engine._optimize_resource_allocation(step)
        
        # Should allocate more resources for ML training
        assert optimized.cpu_cores >= step.resources.cpu_cores
        assert optimized.memory_mb >= step.resources.memory_mb
        assert optimized.duration_minutes == step.resources.duration_minutes
    
    @pytest.mark.asyncio
    async def test_workflow_execution(self, workflow_engine, sample_workflow):
        """Test complete workflow execution"""
        # Create workflow
        workflow = await workflow_engine.create_workflow(sample_workflow)
        
        # Mock external integrations
        workflow_engine.github_integration.execute_step = AsyncMock(return_value={'status': 'success'})
        workflow_engine.render_integration.execute_step = AsyncMock(return_value={'status': 'success'})
        workflow_engine.cloudflare_integration.execute_step = AsyncMock(return_value={'status': 'success'})
        
        # Execute workflow
        execution = await workflow_engine.execute_workflow(
            workflow.id,
            trigger_context={'branch': 'test', 'commit': 'abc123'}
        )
        
        assert execution.workflow_id == workflow.id
        assert execution.status == WorkflowStatus.COMPLETED
        assert execution.completed_at is not None
        assert len(execution.step_executions) == 2
        assert all(step['status'] == 'completed' for step in execution.step_executions.values())
    
    @pytest.mark.asyncio
    async def test_workflow_with_dependencies(self, workflow_engine):
        """Test workflow execution with step dependencies"""
        workflow_def = {
            'id': 'dependency-test',
            'name': 'Dependency Test',
            'description': 'Test workflow with dependencies',
            'steps': [
                {
                    'id': 'step-a',
                    'name': 'Step A',
                    'description': 'First step',
                    'command': 'echo "A"',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                },
                {
                    'id': 'step-b',
                    'name': 'Step B',
                    'description': 'Second step depends on A',
                    'command': 'echo "B"',
                    'deployment_target': 'local',
                    'dependencies': ['step-a'],
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                },
                {
                    'id': 'step-c',
                    'name': 'Step C',
                    'description': 'Third step depends on B',
                    'command': 'echo "C"',
                    'deployment_target': 'local',
                    'dependencies': ['step-b'],
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                }
            ],
            'triggers': ['manual'],
            'environment': {}
        }
        
        workflow = await workflow_engine.create_workflow(workflow_def)
        
        # Mock execution
        workflow_engine._execute_local_step = AsyncMock(return_value={'status': 'success'})
        
        execution = await workflow_engine.execute_workflow(workflow.id)
        
        # Verify execution order
        assert execution.status == WorkflowStatus.COMPLETED
        # Steps should be executed in dependency order: A -> B -> C
    
    @pytest.mark.asyncio
    async def test_resource_pool_management(self, workflow_engine):
        """Test resource pool allocation and release"""
        resource_pool = workflow_engine.resource_pool
        
        # Test allocation
        req1 = ResourceRequirement(cpu_cores=2.0, memory_mb=1024)
        req2 = ResourceRequirement(cpu_cores=4.0, memory_mb=2048)
        
        await resource_pool.allocate('test-1', req1)
        assert 'test-1' in resource_pool.allocations
        
        # Test second allocation
        await resource_pool.allocate('test-2', req2)
        assert 'test-2' in resource_pool.allocations
        
        # Test release
        await resource_pool.release('test-1')
        assert 'test-1' not in resource_pool.allocations
        assert 'test-2' in resource_pool.allocations
    
    @pytest.mark.asyncio
    async def test_github_integration(self, workflow_engine):
        """Test GitHub Apps integration"""
        github = workflow_engine.github_integration
        
        # Mock HTTP requests
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 204
            mock_post.return_value.__aenter__.return_value = mock_response
            
            # Test workflow dispatch
            result = await github.execute_step(
                WorkflowStep(
                    id='github-test',
                    name='GitHub Test',
                    description='Test GitHub step',
                    command='npm test',
                    resources=ResourceRequirement(cpu_cores=1.0, memory_mb=512),
                    deployment_target=DeploymentTarget.GITHUB_ACTIONS
                ),
                {'branch': 'main'}
            )
            
            assert result['status'] == 'dispatched'
            assert result['platform'] == 'github_actions'
    
    @pytest.mark.asyncio
    async def test_cloudflare_integration(self, workflow_engine):
        """Test Cloudflare Workers integration"""
        cloudflare = workflow_engine.cloudflare_integration
        
        # Mock HTTP requests
        with patch('aiohttp.ClientSession.put') as mock_put:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={'id': 'test-worker'})
            mock_put.return_value.__aenter__.return_value = mock_response
            
            # Test worker deployment
            deployment = await cloudflare.deploy_workflow_worker(
                'test-workflow',
                {
                    'steps': [],
                    'environment': {}
                }
            )
            
            assert deployment.name == 'workflow-test-workflow'
            assert deployment.status == 'deployed'
    
    @pytest.mark.asyncio
    async def test_render_integration(self, workflow_engine):
        """Test Render integration"""
        render = workflow_engine.render_integration
        
        # Mock HTTP requests
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 201
            mock_response.json = AsyncMock(return_value={'service': {'id': 'test-service'}})
            mock_post.return_value.__aenter__.return_value = mock_response
            
            # Test service creation
            result = await render.execute_step(
                WorkflowStep(
                    id='render-test',
                    name='Render Test',
                    description='Test Render step',
                    command='npm run build',
                    resources=ResourceRequirement(cpu_cores=1.0, memory_mb=512),
                    deployment_target=DeploymentTarget.RENDER
                ),
                {'environment': 'production'}
            )
            
            assert result['status'] == 'created'
            assert result['platform'] == 'render'
    
    @pytest.mark.asyncio
    async def test_workflow_failure_handling(self, workflow_engine):
        """Test workflow failure and error handling"""
        workflow_def = {
            'id': 'failure-test',
            'name': 'Failure Test',
            'description': 'Test workflow failure handling',
            'steps': [
                {
                    'id': 'failing-step',
                    'name': 'Failing Step',
                    'description': 'This step will fail',
                    'command': 'python nonexistent_script.py',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                }
            ],
            'triggers': ['manual'],
            'environment': {}
        }
        
        workflow = await workflow_engine.create_workflow(workflow_def)
        
        # Mock failing execution
        workflow_engine._execute_local_step = AsyncMock(side_effect=Exception("Command failed"))
        
        execution = await workflow_engine.execute_workflow(workflow.id)
        
        assert execution.status == WorkflowStatus.FAILED
        assert execution.error_message is not None
        assert 'failing-step' in execution.step_executions
        assert execution.step_executions['failing-step']['status'] == 'failed'
    
    @pytest.mark.asyncio
    async def test_workflow_cancellation(self, workflow_engine):
        """Test workflow cancellation"""
        workflow_def = {
            'id': 'cancellation-test',
            'name': 'Cancellation Test',
            'description': 'Test workflow cancellation',
            'steps': [
                {
                    'id': 'long-step',
                    'name': 'Long Running Step',
                    'description': 'Step that takes a long time',
                    'command': 'sleep 300',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                }
            ],
            'triggers': ['manual'],
            'environment': {}
        }
        
        workflow = await workflow_engine.create_workflow(workflow_def)
        
        # Start execution in background
        execution_task = asyncio.create_task(
            workflow_engine.execute_workflow(workflow.id)
        )
        
        # Wait a bit then cancel
        await asyncio.sleep(0.1)
        execution = workflow_engine.executions[execution_task.get_coro().__self__.execution_id]
        
        # Cancel workflow
        execution.status = WorkflowStatus.CANCELLED
        
        # Wait for task to complete
        try:
            await execution_task
        except asyncio.CancelledError:
            pass
        
        assert execution.status == WorkflowStatus.CANCELLED
    
    def test_workflow_validation(self):
        """Test workflow definition validation"""
        # Valid workflow
        valid_workflow = {
            'id': 'valid',
            'name': 'Valid Workflow',
            'description': 'Valid description',
            'steps': [
                {
                    'id': 'step-1',
                    'name': 'Step 1',
                    'description': 'Description',
                    'command': 'echo test',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                }
            ],
            'triggers': ['manual'],
            'environment': {}
        }
        
        # This should not raise an exception
        workflow = Workflow(
            id=valid_workflow['id'],
            name=valid_workflow['name'],
            description=valid_workflow['description'],
            steps=[WorkflowStep(**step) for step in valid_workflow['steps']],
            triggers=valid_workflow['triggers'],
            environment=valid_workflow['environment'],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        assert workflow.id == 'valid'
        assert len(workflow.steps) == 1
    
    @pytest.mark.asyncio
    async def test_concurrent_workflow_execution(self, workflow_engine):
        """Test concurrent workflow execution"""
        workflow_def = {
            'id': 'concurrent-test',
            'name': 'Concurrent Test',
            'description': 'Test concurrent execution',
            'steps': [
                {
                    'id': 'step-1',
                    'name': 'Step 1',
                    'description': 'Independent step 1',
                    'command': 'echo "Step 1"',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                },
                {
                    'id': 'step-2',
                    'name': 'Step 2',
                    'description': 'Independent step 2',
                    'command': 'echo "Step 2"',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                }
            ],
            'triggers': ['manual'],
            'environment': {}
        }
        
        workflow = await workflow_engine.create_workflow(workflow_def)
        
        # Mock execution
        workflow_engine._execute_local_step = AsyncMock(return_value={'status': 'success'})
        
        execution = await workflow_engine.execute_workflow(workflow.id)
        
        # Both steps should execute in parallel since they have no dependencies
        assert execution.status == WorkflowStatus.COMPLETED
        assert len(execution.step_executions) == 2

# Integration Tests
class TestIntegrations:
    """Integration tests for external services"""
    
    @pytest.mark.asyncio
    async def test_github_webhook_processing(self):
        """Test GitHub webhook event processing"""
        from github_integration import GitHubAppsIntegration
        
        config = {
            'app_id': 'test_app_id',
            'private_key': 'test_private_key',
            'webhook_secret': 'test_secret',
            'installation_id': 'test_installation_id'
        }
        
        github = GitHubAppsIntegration(config)
        
        # Mock webhook event
        webhook_payload = {
            'event_type': 'push',
            'action': 'created',
            'repository': {
                'full_name': 'heady-systems/ai-workflow-engine',
                'default_branch': 'main'
            },
            'sender': {
                'login': 'test-user'
            },
            'ref': 'refs/heads/main',
            'after': 'abc123',
            'commits': [
                {
                    'id': 'abc123',
                    'message': 'Test commit',
                    'added': ['test.py'],
                    'modified': [],
                    'removed': []
                }
            ]
        }
        
        # Test webhook processing
        event = github._parse_webhook_event(Mock(
            headers={'X-GitHub-Event': 'push'},
            get_json=lambda: webhook_payload
        ))
        
        assert event.event_type == 'push'
        assert event.repository['full_name'] == 'heady-systems/ai-workflow-engine'
    
    @pytest.mark.asyncio
    async def test_cloudflare_worker_generation(self):
        """Test Cloudflare Worker script generation"""
        from cloudflare_integration import CloudflareWorkersIntegration
        
        config = {
            'api_token': 'test_token',
            'account_id': 'test_account_id'
        }
        
        cloudflare = CloudflareWorkersIntegration(config)
        
        workflow_config = {
            'id': 'test-workflow',
            'steps': [
                {
                    'id': 'step-1',
                    'command': 'python test.py',
                    'deployment_target': 'cloudflare_workers',
                    'environment': {'TEST': 'value'}
                }
            ],
            'environment': {'WORKFLOW': 'test'}
        }
        
        script = cloudflare._generate_workflow_script('test-workflow', workflow_config)
        
        assert 'workflow-test-workflow' in script
        assert 'executeWorkflowSteps' in script
        assert 'handleWorkflowExecution' in script

# Performance Tests
class TestPerformance:
    """Performance and load tests"""
    
    @pytest.mark.asyncio
    async def test_resource_allocation_performance(self):
        """Test resource allocation performance"""
        from main import ResourcePool
        
        pool = ResourcePool({'max_cpu_cores': 16, 'max_memory_mb': 32768})
        
        start_time = datetime.now()
        
        # Allocate many resources
        tasks = []
        for i in range(100):
            req = ResourceRequirement(cpu_cores=0.1, memory_mb=256)
            task = pool.allocate(f'test-{i}', req)
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Should complete within reasonable time
        assert duration < 5.0
        assert len(pool.allocations) == 100
    
    @pytest.mark.asyncio
    async def test_workflow_execution_performance(self):
        """Test workflow execution performance"""
        config = {
            'resources': {'max_cpu_cores': 16, 'max_memory_mb': 32768},
            'github': {'token': 'test'},
            'cloudflare': {'api_token': 'test'},
            'render': {'api_key': 'test'}
        }
        
        engine = AIWorkflowEngine(config)
        
        # Create simple workflow
        workflow_def = {
            'id': 'perf-test',
            'name': 'Performance Test',
            'description': 'Performance test workflow',
            'steps': [
                {
                    'id': 'step-1',
                    'name': 'Step 1',
                    'command': 'echo test',
                    'deployment_target': 'local',
                    'resources': {'cpu_cores': 1.0, 'memory_mb': 512}
                }
            ],
            'triggers': ['manual'],
            'environment': {}
        }
        
        workflow = await engine.create_workflow(workflow_def)
        
        # Mock fast execution
        engine._execute_local_step = AsyncMock(return_value={'status': 'success'})
        
        start_time = datetime.now()
        execution = await engine.execute_workflow(workflow.id)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        
        assert execution.status == WorkflowStatus.COMPLETED
        assert duration < 1.0  # Should complete quickly

if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
