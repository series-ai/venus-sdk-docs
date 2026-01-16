---
icon: terminal
---

# Venus CLI - CI/CD Pipeline Guide

This guide demonstrates how to use the Venus CLI in CI/CD pipelines with authentication key support.

### Authentication

Venus CLI supports authentication via environment variables.&#x20;

You can find your authentication refresh token on Mac/Linux at:

```
~/.venus/<env_name>.session.json
```

On Windows, you can find it at:

```
%APPDATA%\.venus\<env_name>.session.json
```

Set your authentication key using:

```bash
export VENUS_REFRESH_TOKEN=your-authentication-key
```

The CLI will automatically detect and use this key for remote operations.

### Security Best Practices

1. **Never commit keys to source control** - Always use your CI/CD platform's secret management
2. **Use secret scanning** - Enable secret detection in your repositories
3. **Rotate keys regularly** - Update keys periodically and after team changes
4. **Limit key permissions** - Use keys with minimal required permissions
5. **Audit key usage** - Monitor and log key usage for security compliance

### GitHub Actions

#### Basic Setup

```yaml
name: Venus CLI Pipeline
on: [push, pull_request]

jobs:
  venus-deployment:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Venus CLI
        run: |
          # Install Venus CLI (adjust based on your installation method)
          curl -fsSL https://example.com/install-venus.sh | sh
          # Or: npm install -g venus-cli
          # Or: pip install venus-cli

      - name: Run Venus commands
        env:
          VENUS_KEY: ${{ secrets.VENUS_REFRESH_TOKEN }}
        run: |
          venus deploy --environment production
          venus status
```

#### Multiple Environments

```yaml
name: Venus Multi-Environment Deploy
on:
  push:
    branches: [main, staging, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Venus CLI
        run: npm install -g venus-cli

      - name: Deploy to staging
        if: github.ref == 'refs/heads/staging'
        env:
          VENUS_KEY: ${{ secrets.VENUS_KEY_STAGING }}
        run: venus deploy --environment staging

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        env:
          VENUS_KEY: ${{ secrets.VENUS_REFRESH_TOKEN_PROD }}
        run: venus deploy --environment production

      - name: Deploy to development
        if: github.ref == 'refs/heads/develop'
        env:
          VENUS_KEY: ${{ secrets.VENUS_REFRESH_TOKEN_DEV }}
        run: venus deploy --environment development
```

#### Setting up secrets in GitHub

1. Navigate to your repository settings
2. Go to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `VENUS_REFRESH_TOKEN`
5. Value: Your Venus authentication key
6. Click **Add secret**

### GitLab CI

#### Basic Configuration

```yaml
# .gitlab-ci.yml
stages:
  - deploy
  - verify

variables:
  VENUS_VERSION: "latest"

before_script:
  - curl -fsSL https://example.com/install-venus.sh | sh
  # Or: npm install -g venus-cli

deploy:
  stage: deploy
  script:
    - venus deploy --environment production
    - venus status
  environment:
    name: production
  only:
    - main

verify:
  stage: verify
  script:
    - venus verify
  only:
    - main
```

#### Multi-Environment with Protected Variables

```yaml
# .gitlab-ci.yml
stages:
  - deploy

.deploy_template:
  before_script:
    - npm install -g venus-cli
  script:
    - venus deploy --environment $CI_ENVIRONMENT_NAME
    - venus logs --tail 50

deploy_staging:
  extends: .deploy_template
  stage: deploy
  environment:
    name: staging
  variables:
    VENUS_KEY: $VENUS_REFRESH_TOKEN_STAGING
  only:
    - staging

deploy_production:
  extends: .deploy_template
  stage: deploy
  environment:
    name: production
  variables:
    VENUS_KEY: $VENUS_REFRESH_TOKEN_PROD
  only:
    - main
  when: manual
```

#### Setting up variables in GitLab

1. Navigate to **Settings** → **CI/CD**
2. Expand **Variables**
3. Click **Add variable**
4. Key: `VENUS_REFRESH_TOKEN`
5. Value: Your Venus authentication key
6. Check **Protect variable** (recommended for production keys)
7. Check **Mask variable** to hide in logs
8. Click **Add variable**

### Jenkins

#### Declarative Pipeline

```groovy
pipeline {
    agent any

    environment {
        VENUS_KEY = credentials('venus-api-key')
    }

    stages {
        stage('Install Venus CLI') {
            steps {
                sh '''
                    curl -fsSL https://example.com/install-venus.sh | sh
                    venus --version
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh 'venus deploy --environment production'
            }
        }

        stage('Verify') {
            steps {
                sh 'venus status'
                sh 'venus health-check'
            }
        }
    }

    post {
        success {
            echo 'Venus deployment successful!'
        }
        failure {
            echo 'Venus deployment failed!'
        }
    }
}
```

#### Multi-Branch Pipeline

```groovy
pipeline {
    agent any

    environment {
        VENUS_REFRESH_TOKEN = credentials("venus-key-${env.BRANCH_NAME}")
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g venus-cli'
            }
        }

        stage('Deploy') {
            steps {
                script {
                    def environment = 'development'
                    if (env.BRANCH_NAME == 'main') {
                        environment = 'production'
                    } else if (env.BRANCH_NAME == 'staging') {
                        environment = 'staging'
                    }

                    sh "venus deploy --environment ${environment}"
                }
            }
        }
    }
}
```

#### Setting up credentials in Jenkins

1. Navigate to **Manage Jenkins** → **Manage Credentials**
2. Select the appropriate domain
3. Click **Add Credentials**
4. Kind: **Secret text**
5. Secret: Your Venus authentication key
6. ID: `venus-refresh-token`
7. Description: Venus refresh token
8. Click **OK**

### CircleCI

#### Basic Configuration

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  deploy:
    docker:
      - image: cimg/node:lts
    steps:
      - checkout

      - run:
          name: Install Venus CLI
          command: |
            curl -fsSL https://example.com/install-venus.sh | sh
            # Or: npm install -g venus-cli

      - run:
          name: Deploy with Venus
          command: |
            venus deploy --environment production
            venus status

workflows:
  version: 2
  deploy-workflow:
    jobs:
      - deploy:
          filters:
            branches:
              only: main
```

#### Multi-Environment Workflow

```yaml
# .circleci/config.yml
version: 2.1

executors:
  venus-executor:
    docker:
      - image: cimg/node:lts

commands:
  install-venus:
    steps:
      - run:
          name: Install Venus CLI
          command: npm install -g venus-cli

jobs:
  deploy-staging:
    executor: venus-executor
    steps:
      - checkout
      - install-venus
      - run:
          name: Deploy to Staging
          command: venus deploy --environment staging

  deploy-production:
    executor: venus-executor
    steps:
      - checkout
      - install-venus
      - run:
          name: Deploy to Production
          command: venus deploy --environment production
      - run:
          name: Verify Deployment
          command: venus verify --environment production

workflows:
  version: 2
  deploy-pipeline:
    jobs:
      - deploy-staging:
          filters:
            branches:
              only: staging
          context: venus-staging

      - deploy-production:
          filters:
            branches:
              only: main
          context: venus-production
          requires:
            - deploy-staging
```

#### Setting up environment variables in CircleCI

1. Navigate to your project settings
2. Click **Environment Variables**
3. Click **Add Environment Variable**
4. Name: `VENUS_KEY`
5. Value: Your Venus authentication key
6. Click **Add Variable**

For context-based variables:

1. Go to **Organization Settings** → **Contexts**
2. Create or select a context (e.g., `venus-production`)
3. Click **Add Environment Variable**
4. Add `VENUS_KEY` with the appropriate value

### Common Venus CLI Commands

```bash
# Deploy to an environment
venus deploy --environment <env>

# Check deployment status
venus status

# View logs
venus logs --tail 100

# Run health checks
venus health-check

# Verify deployment
venus verify

# Rollback deployment
venus rollback --version <version>

# List available environments
venus env list

# Get current version
venus --version
```

### Troubleshooting

#### Authentication Errors

**Error**: "Authentication failed" or "Invalid key"

**Solutions**:

* Verify the `VENUS_KEY` environment variable is set correctly
* Check that the key hasn't expired or been revoked
* Ensure no extra whitespace in the key value
* Verify the key has permissions for the target environment

#### Network/Connection Issues

**Error**: "Connection timeout" or "Unable to reach Venus server"

**Solutions**:

* Check your CI/CD runner has internet access
* Verify firewall rules allow outbound connections
* Check if you need to configure proxy settings
* Ensure Venus service is operational

#### Installation Problems

**Error**: Venus CLI not found or installation fails

**Solutions**:

* Verify the installation command is correct for your OS
* Check if you need elevated permissions
* Try alternative installation methods (npm, pip, binary download)
* Ensure dependencies are installed

### Advanced Configuration

#### Using Venus with Docker

```dockerfile
FROM node:lts-alpine

# Install Venus CLI
RUN npm install -g venus-cli

# Copy your application
WORKDIR /app
COPY . .

# The key will be provided at runtime
CMD ["venus", "deploy", "--environment", "production"]
```

```yaml
# In your CI configuration
deploy:
  script:
    - docker build -t myapp .
    - docker run -e VENUS_KEY=$VENUS_KEY myapp
```

#### Caching Venus CLI Installation

**GitHub Actions**:

```yaml
- name: Cache Venus CLI
  uses: actions/cache@v3
  with:
    path: ~/.venus
    key: venus-cli-${{ runner.os }}-${{ hashFiles('**/venus.lock') }}
```

**GitLab CI**:

```yaml
cache:
  paths:
    - .venus/
```

#### Conditional Deployments

```bash
# Only deploy if tests pass
venus test && venus deploy --environment production

# Deploy with version tagging
venus deploy --environment production --tag "v${CI_COMMIT_TAG}"

# Deploy with custom configuration
venus deploy --environment production --config custom-config.yml
```

