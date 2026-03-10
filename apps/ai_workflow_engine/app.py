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
# ║  FILE: apps/ai_workflow_engine/app.py                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
"""
AI Workflow Engine FastAPI Application
Main entry point for the workflow orchestration system
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import asyncio
import logging
from datetime import datetime
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AI Workflow Engine",
    description="Dynamic resource allocation and intelligent workflow orchestration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class WorkflowRequest(BaseModel):
    id: str
    name: str
    description: str
    steps: List[Dict[str, Any]]
    triggers: List[str] = []
    environment: Dict[str, str] = {}

class WorkflowExecutionRequest(BaseModel):
    workflow_id: str
    inputs: Dict[str, Any] = {}

class ResourceStatus(BaseModel):
    cpu_cores: float
    memory_mb: int
    gpu_memory_mb: int
    allocated: int
    available: int

# Global workflow engine instance
workflow_engine = None

@app.on_event("startup")
async def startup_event():
    """Initialize the workflow engine on startup"""
    global workflow_engine
    try:
        # Import the simplified workflow engine
        from workflow_engine import AIWorkflowEngine
        
        workflow_engine = AIWorkflowEngine()
        logger.info("AI Workflow Engine initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize workflow engine: {e}")
        # Continue without workflow engine for basic functionality

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Workflow Engine",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-workflow-engine",
        "timestamp": datetime.now().isoformat(),
        "workflow_engine": workflow_engine is not None
    }

@app.get("/api/workflows")
async def list_workflows():
    """List all workflows"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    workflows = []
    for workflow_id, workflow in workflow_engine.workflows.items():
        workflows.append({
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "status": workflow.status.value,
            "created_at": workflow.created_at.isoformat(),
            "step_count": len(workflow.steps)
        })
    
    return {"workflows": workflows}

@app.post("/api/workflows")
async def create_workflow(workflow_request: WorkflowRequest):
    """Create a new workflow"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    try:
        workflow = await workflow_engine.create_workflow(workflow_request.dict())
        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status.value,
            "message": "Workflow created successfully"
        }
    except Exception as e:
        logger.error(f"Failed to create workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get workflow details"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    if workflow_id not in workflow_engine.workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflow_engine.workflows[workflow_id]
    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "status": workflow.status.value,
        "steps": [
            {
                "id": step.id,
                "name": step.name,
                "description": step.description,
                "deployment_target": step.deployment_target.value,
                "dependencies": step.dependencies or [],
                "resources": {
                    "cpu_cores": step.resources.cpu_cores,
                    "memory_mb": step.resources.memory_mb,
                    "gpu_memory_mb": step.resources.gpu_memory_mb,
                    "duration_minutes": step.resources.duration_minutes
                }
            }
            for step in workflow.steps
        ],
        "triggers": workflow.triggers,
        "environment": workflow.environment,
        "created_at": workflow.created_at.isoformat(),
        "updated_at": workflow.updated_at.isoformat()
    }

@app.post("/api/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, request: WorkflowExecutionRequest, background_tasks: BackgroundTasks):
    """Execute a workflow"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    if workflow_id not in workflow_engine.workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    try:
        # Execute workflow in background
        background_tasks.add_task(
            execute_workflow_background,
            workflow_id,
            request.inputs
        )
        
        return {
            "message": "Workflow execution started",
            "workflow_id": workflow_id,
            "inputs": request.inputs
        }
        
    except Exception as e:
        logger.error(f"Failed to execute workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def execute_workflow_background(workflow_id: str, inputs: Dict[str, Any]):
    """Background task for workflow execution"""
    try:
        execution = await workflow_engine.execute_workflow(workflow_id, inputs)
        logger.info(f"Workflow {workflow_id} execution completed: {execution.execution_id}")
    except Exception as e:
        logger.error(f"Workflow {workflow_id} execution failed: {e}")

@app.get("/api/executions/{execution_id}/status")
async def get_execution_status(execution_id: str):
    """Get execution status"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    if execution_id not in workflow_engine.executions:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution = workflow_engine.executions[execution_id]
    return {
        "execution_id": execution.execution_id,
        "workflow_id": execution.workflow_id,
        "status": execution.status.value,
        "started_at": execution.started_at.isoformat(),
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
        "step_executions": execution.step_executions,
        "error_message": execution.error_message,
        "log_count": len(execution.logs)
    }

@app.get("/api/executions/{execution_id}/logs")
async def get_execution_logs(execution_id: str):
    """Get execution logs"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    if execution_id not in workflow_engine.executions:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution = workflow_engine.executions[execution_id]
    return {
        "execution_id": execution_id,
        "logs": execution.logs,
        "log_count": len(execution.logs)
    }

@app.post("/api/executions/{execution_id}/cancel")
async def cancel_execution(execution_id: str):
    """Cancel workflow execution"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    if execution_id not in workflow_engine.executions:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution = workflow_engine.executions[execution_id]
    execution.status = WorkflowStatus.CANCELLED
    
    return {
        "execution_id": execution_id,
        "status": "cancelled",
        "message": "Execution cancelled successfully"
    }

@app.get("/api/resources/status")
async def get_resource_status():
    """Get resource pool status"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    try:
        status = workflow_engine.resource_pool.get_system_load()
        return {
            "system_resources": status,
            "allocations": len(workflow_engine.resource_pool.allocations),
            "max_resources": workflow_engine.resource_pool.config
        }
    except Exception as e:
        logger.error(f"Failed to get resource status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/integrations/status")
async def get_integrations_status():
    """Get integration status"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    integrations = {}
    
    # GitHub integration
    try:
        github_status = await workflow_engine.github_integration.list_all_servers()
        integrations["github"] = {"status": "connected", "servers": github_status}
    except Exception as e:
        integrations["github"] = {"status": "disconnected", "error": str(e)}
    
    # Cloudflare integration
    try:
        cf_workers = await workflow_engine.cloudflare_integration.list_workers()
        integrations["cloudflare"] = {"status": "connected", "workers": len(cf_workers)}
    except Exception as e:
        integrations["cloudflare"] = {"status": "disconnected", "error": str(e)}
    
    # Render integration
    try:
        # Mock render status check
        integrations["render"] = {"status": "connected"}
    except Exception as e:
        integrations["render"] = {"status": "disconnected", "error": str(e)}
    
    return integrations

@app.get("/api/metrics")
async def get_metrics():
    """Get system metrics"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    
    return {
        "workflows": {
            "total": len(workflow_engine.workflows),
            "pending": sum(1 for w in workflow_engine.workflows.values() if w.status == WorkflowStatus.PENDING),
            "running": sum(1 for w in workflow_engine.workflows.values() if w.status == WorkflowStatus.RUNNING),
            "completed": sum(1 for w in workflow_engine.workflows.values() if w.status == WorkflowStatus.COMPLETED),
            "failed": sum(1 for w in workflow_engine.workflows.values() if w.status == WorkflowStatus.FAILED)
        },
        "executions": {
            "total": len(workflow_engine.executions),
            "active": sum(1 for e in workflow_engine.executions.values() if e.status == WorkflowStatus.RUNNING),
            "completed": sum(1 for e in workflow_engine.executions.values() if e.status == WorkflowStatus.COMPLETED),
            "failed": sum(1 for e in workflow_engine.executions.values() if e.status == WorkflowStatus.FAILED)
        },
        "resources": workflow_engine.resource_pool.get_system_load()
    }

# Example workflow endpoint for testing
@app.get("/api/examples/workflows")
async def get_example_workflows():
    """Get example workflow definitions"""
    return {
        "workflows": [
            {
                "id": "ai-model-training",
                "name": "AI Model Training Pipeline",
                "description": "Complete ML model training with dynamic resource allocation",
                "steps": [
                    {
                        "id": "data-prep",
                        "name": "Data Preparation",
                        "description": "Prepare and validate training data",
                        "command": "python scripts/prepare_data.py --input data/raw --output data/processed",
                        "deployment_target": "render",
                        "resources": {
                            "cpu_cores": 2.0,
                            "memory_mb": 4096,
                            "duration_minutes": 30
                        }
                    },
                    {
                        "id": "model-training",
                        "name": "Model Training",
                        "description": "Train the ML model with GPU acceleration",
                        "command": "python scripts/train_model.py --data data/processed --output models/ --gpu",
                        "deployment_target": "render",
                        "dependencies": ["data-prep"],
                        "resources": {
                            "cpu_cores": 8.0,
                            "memory_mb": 16384,
                            "gpu_memory_mb": 8192,
                            "duration_minutes": 120
                        }
                    },
                    {
                        "id": "model-deployment",
                        "name": "Model Deployment",
                        "description": "Deploy trained model to Cloudflare Workers",
                        "command": "wrangler deploy --env production",
                        "deployment_target": "cloudflare_workers",
                        "dependencies": ["model-training"],
                        "resources": {
                            "cpu_cores": 1.0,
                            "memory_mb": 128,
                            "duration_minutes": 15
                        }
                    }
                ],
                "triggers": ["github_push", "manual"],
                "environment": {
                    "PYTHONPATH": "/app",
                    "MODEL_VERSION": "latest",
                    "GPU_ENABLED": "true"
                }
            },
            {
                "id": "web-app-deployment",
                "name": "Web Application Deployment",
                "description": "Build and deploy web application",
                "steps": [
                    {
                        "id": "build",
                        "name": "Build Application",
                        "description": "Build web application",
                        "command": "npm run build",
                        "deployment_target": "github_actions",
                        "resources": {
                            "cpu_cores": 2.0,
                            "memory_mb": 2048,
                            "duration_minutes": 10
                        }
                    },
                    {
                        "id": "deploy",
                        "name": "Deploy to Production",
                        "description": "Deploy to Render",
                        "command": "render deploy",
                        "deployment_target": "render",
                        "dependencies": ["build"],
                        "resources": {
                            "cpu_cores": 1.0,
                            "memory_mb": 1024,
                            "duration_minutes": 5
                        }
                    }
                ],
                "triggers": ["github_push"],
                "environment": {
                    "NODE_ENV": "production",
                    "BUILD_TOOL": "webpack"
                }
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True if os.getenv("ENVIRONMENT") == "development" else False,
        workers=1 if os.getenv("ENVIRONMENT") == "development" else 4
    )
