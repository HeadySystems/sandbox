<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: apps/ai_workflow_engine/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# AI Workflow Engine

A comprehensive AI-powered workflow orchestration system with dynamic resource allocation, integrating GitHub Apps, Cloudflare Workers, Render, and Gists for intelligent automation.

## 🚀 Features

### Core Capabilities
- **Dynamic Resource Allocation**: AI-powered optimization of CPU, memory, and GPU resources
- **Multi-Platform Deployment**: Support for Cloudflare Workers, Render, GitHub Actions, and local execution
- **Intelligent Orchestration**: Automatic dependency resolution and parallel execution
- **Real-time Monitoring**: Comprehensive logging, metrics, and status tracking

### Integrations
- **GitHub Apps & Actions**: Webhook processing, workflow dispatch, and status updates
- **Cloudflare Workers**: Serverless workflow execution with KV storage and D1 databases
- **Render**: Container-based deployment with automatic scaling
- **GitHub Gists**: Workflow definition storage and versioning
- **Monitoring Stack**: Prometheus, Grafana, and Sentry for observability

## 📋 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Apps   │    │ Cloudflare      │    │     Render      │
│   & Actions     │    │    Workers      │    │   Services      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │    AI Workflow Engine     │
                    │  (Dynamic Allocation)     │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   Resource Pool Manager   │
                    │   PostgreSQL + Redis      │
                    └───────────────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)
- GitHub Apps credentials
- Cloudflare API token
- Render API key

### Quick Start

1. **Clone and Setup**
```bash
git clone https://github.com/heady-systems/ai-workflow-engine.git
cd ai-workflow-engine
cp apps/ai_workflow_engine/.env.example apps/ai_workflow_engine/.env
```

2. **Configure Environment**
```bash
# Edit .env with your credentials
nano apps/ai_workflow_engine/.env
```

3. **Deploy with Docker Compose**
```bash
cd apps/ai_workflow_engine
docker-compose up -d
```

4. **Verify Deployment**
```bash
curl http://localhost:8000/health
```

### Manual Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Setup database
alembic upgrade head

# Start services
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub personal access token | Yes |
| `GITHUB_APP_ID` | GitHub App ID | Yes |
| `GITHUB_PRIVATE_KEY` | GitHub App private key | Yes |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Yes |
| `RENDER_API_KEY` | Render API key | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |

### Resource Limits

```python
# Configure resource allocation limits
MAX_CPU_CORES = 16
MAX_MEMORY_MB = 32768
MAX_GPU_MEMORY_MB = 16384
MAX_CONCURRENT_WORKFLOWS = 10
```

## 📊 Usage

### Creating a Workflow

```python
from main import workflow_engine

workflow_def = {
    'id': 'ai-model-training',
    'name': 'AI Model Training Pipeline',
    'description': 'Complete ML model training with dynamic resources',
    'steps': [
        {
            'id': 'data-prep',
            'name': 'Data Preparation',
            'command': 'python scripts/prepare_data.py',
            'deployment_target': 'render',
            'resources': {
                'cpu_cores': 2.0,
                'memory_mb': 4096,
                'duration_minutes': 30
            }
        },
        {
            'id': 'model-training',
            'name': 'Model Training',
            'command': 'python scripts/train_model.py',
            'deployment_target': 'render',
            'dependencies': ['data-prep'],
            'resources': {
                'cpu_cores': 8.0,
                'memory_mb': 16384,
                'gpu_memory_mb': 8192,
                'duration_minutes': 120
            }
        }
    ],
    'triggers': ['github_push', 'manual'],
    'environment': {
        'PYTHONPATH': '/app',
        'MODEL_VERSION': 'latest'
    }
}

# Create workflow
workflow = await workflow_engine.create_workflow(workflow_def)

# Execute workflow
execution = await workflow_engine.execute_workflow(
    workflow.id,
    trigger_context={'branch': 'main', 'commit': 'abc123'}
)
```

### REST API

```bash
# Create workflow
curl -X POST http://localhost:8000/api/workflows \
  -H "Content-Type: application/json" \
  -d @workflow.json

# Execute workflow
curl -X POST http://localhost:8000/api/workflows/{workflow_id}/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"param1": "value1"}}'

# Get execution status
curl http://localhost:8000/api/executions/{execution_id}/status

# Get workflow logs
curl http://localhost:8000/api/executions/{execution_id}/logs
```

### GitHub Integration

Setup GitHub Apps webhook:
```bash
# Webhook URL
https://your-domain.com/webhook/github

# Events
- Push
- Pull Request
- Workflow Dispatch
- Check Run
```

## 📈 Monitoring

### Grafana Dashboard
- URL: http://localhost:3000
- Default credentials: admin/admin

### Prometheus Metrics
- URL: http://localhost:9090
- Key metrics:
  - `workflow_executions_total`
  - `workflow_duration_seconds`
  - `resource_utilization_percent`
  - `active_workflows_count`

### Flower (Celery Monitoring)
- URL: http://localhost:5555
- Monitor background tasks and queues

## 🔒 Security

### Authentication
- JWT-based authentication
- GitHub App integration
- API key management

### Security Features
- Input validation and sanitization
- Resource isolation
- Secure secret management
- Audit logging

### Security Scanning
```bash
# Run security scans
bandit -r . -f json
safety check
trivy fs .
```

## 🚀 Deployment

### Render Deployment
```bash
# Deploy to Render
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @render-service.json
```

### Cloudflare Workers Deployment
```bash
# Deploy to Cloudflare
wrangler deploy --env production
```

### GitHub Actions
Automated deployment on push to main branch:
- Tests and security scans
- Docker image building
- Multi-platform deployment
- Status updates

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v --cov=.

# Run specific test
pytest tests/test_workflow_engine.py -v

# Run with coverage
pytest tests/ --cov=workflow_engine --cov-report=html

# Run security tests
pytest tests/security/ -v
```

## 📚 API Reference

### Workflow Management
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/{id}` - Get workflow details
- `PUT /api/workflows/{id}` - Update workflow
- `DELETE /api/workflows/{id}` - Delete workflow

### Execution Management
- `POST /api/workflows/{id}/execute` - Execute workflow
- `GET /api/executions/{id}/status` - Get execution status
- `POST /api/executions/{id}/cancel` - Cancel execution
- `GET /api/executions/{id}/logs` - Get execution logs

### Resource Management
- `GET /api/resources/status` - Get resource pool status
- `POST /api/resources/allocate` - Allocate resources
- `POST /api/resources/release` - Release resources

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Setup
```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Setup pre-commit hooks
pre-commit install

# Run linting
black .
isort .
flake8 .
mypy .
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: https://docs.heady-systems.com/ai-workflow-engine
- **Issues**: https://github.com/heady-systems/ai-workflow-engine/issues
- **Discussions**: https://github.com/heady-systems/ai-workflow-engine/discussions
- **Email**: support@heady-systems.com

## 🗺️ Roadmap

### v1.0 (Current)
- [x] Core workflow engine
- [x] Dynamic resource allocation
- [x] GitHub Apps integration
- [x] Cloudflare Workers deployment
- [x] Render integration
- [x] Monitoring and logging

### v1.1 (Planned)
- [ ] Advanced AI scheduling
- [ ] Multi-cloud support
- [ ] Workflow templates marketplace
- [ ] Advanced security features
- [ ] Performance optimizations

### v2.0 (Future)
- [ ] Visual workflow designer
- [ ] Machine learning optimization
- [ ] Enterprise features
- [ ] Advanced analytics
- [ ] Mobile app

## 🙏 Acknowledgments

- **Cloudflare** for Workers and KV storage
- **GitHub** for Apps and Actions
- **Render** for container hosting
- **FastAPI** for the web framework
- **Celery** for background tasks

---

Built with ❤️ by the Heady Systems team
