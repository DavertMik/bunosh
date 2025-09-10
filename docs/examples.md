# Bunosh Examples

This document contains practical examples of using Bunosh for various development and operations tasks.

## Development Examples

### Feature Branch Workflow

```
bunosh worktree:create
bunosh worktree:delete
```

```javascript
/**
 * Create worktree for feature development
 */
export async function worktreeCreate(name = '') {
  const worktreeName = name || await ask('What is feature name?');
  const newDir = `../app-${worktreeName}`;

  await exec`git worktree add ${newDir}`;
  say(`Created worktree for feature ${worktreeName} in ${newDir}`);
}

/**
 * Remove worktree when feature is merged
 */
export async function worktreeDelete(worktree = '') {
  const worktrees = await shell`git worktree list`;
  const worktreePaths = worktrees.output
    .split('\n')
    .map(line => line.split(' ')[0])
    .filter(path => path !== process.cwd());

  if (worktreePaths.length === 0) {
    say('No worktrees found');
    return;
  }

  const worktreeName = worktree || await ask('Select worktree to delete', worktreePaths);
  const rmDir = worktreePaths.find(path => path.includes(worktreeName));

  if (!rmDir) {
    say(`Worktree for feature ${worktreeName} not found`);
    return;
  }

  await exec`git worktree remove ${rmDir} --force`;
  say(`Deleted worktree for feature ${worktreeName} in ${rmDir}`);
}
```

### Generate Release Notes with AI

```javascript
/**
 * Generate comprehensive release notes using AI
 */
export async function generateReleaseNotes(fromTag = '', toTag = 'HEAD') {
  const { ai, writeToFile, exec, say, ask } = global.bunosh;

  // Get version
  const version = await ask('Release version:', '1.0.0');

  // Get commit history
  const gitLog = fromTag
    ? await exec`git log ${fromTag}..${toTag} --pretty=format:"%h %s" --no-merges`
    : await exec`git log -n 50 --pretty=format:"%h %s" --no-merges`;

  // Get diff statistics
  const stats = fromTag
    ? await exec`git diff --stat ${fromTag}..${toTag}`
    : await exec`git diff --stat HEAD~50..HEAD`;

  // Generate release notes with AI
  const releaseNotes = await ai(
    `Generate professional release notes for version ${version} based on these commits and changes:

    Commits:
    ${gitLog.output}

    Statistics:
    ${stats.output}

    Group changes logically and write user-friendly descriptions.`,
    {
      features: 'New features (bullet points with emoji)',
      fixes: 'Bug fixes',
      acknowledgments: 'Contributors and acknowledgments'
    }
  );

  // Write release notes
  writeToFile(`CHANGELOG.md`, (line) => {
    line`# Release v${version}`;
    line`*${new Date().toLocaleDateString()}*`;
    line``;
    line`## ✨ New Features`;
    line`${releaseNotes.features}`;
    line``;
    line`## 🐛 Bug Fixes`;
    line`${releaseNotes.fixes}`;
    line``;
    line`## 🙏 Acknowledgments`;
    line`${releaseNotes.acknowledgments}`;

    // append previous contents
    line.fromFile('CHANGELOG.md');
  });

  say(`📝 Release notes generated for v${version}`);
}
```

### Analyze Logs with AI

```js
const fileContents = await shell`tail -n 500 error.log`
const analysis = await ai(`Analyze this error log ${fileContents.output}`, {
  severity: "critical/high/medium/low",
  rootCause: "specific issue identified",
  solution: "step-by-step fix",
  preventionTips: "how to avoid this"
});
```

### Build and Publish Containers in Parallel

```javascript
/**
 * Build and publish multiple services in parallel
 */
export async function publishContainers(registry = 'docker.io/myorg') {
  const { exec, task, say, yell } = global.bunosh;

  const services = ['api', 'web', 'worker', 'admin'];
  const version = process.env.VERSION || 'latest';

  say(`🐳 Building ${services.length} containers...`);

  task.stopOnFailures();
  // Build all containers in parallel
  const buildResults = await Promise.all(
    services.map(service =>
      exec`docker build -t ${registry}/${service}:${version} -f ${service}/Dockerfile ${service}`
    )
  );

  say('✅ All containers built successfully');

  // Push all containers in parallel
  say('📤 Publishing to registry...');

  const pushResults = await Promise.all(
    services.map(service =>
      exec`docker push ${registry}/${service}:${version}`
    )
  );

  yell('CONTAINERS PUBLISHED!');
  say(`Published: ${pushResults.join(', ')}`);
  say(`Registry: ${registry}`);
  say(`Version: ${version}`);
}
```

### Kubernetes Deployment Control

```javascript
/**
 * Deploy to Kubernetes with health checks
 */
export async function kubeDeploy(
  environment = 'staging',
  options = { wait: true, replicas: 3 }
) {
  const { exec, task, say, yell, ask } = global.bunosh;

  // Confirm production deployments
  if (environment === 'production') {
    const confirmed = await ask(
      `⚠️ Deploy to PRODUCTION?`,
      false
    );
    if (!confirmed) {
      say('Deployment cancelled');
      return;
    }
  }

  // Set kubectl context
  await task('Setting context', () =>
    exec`kubectl config use-context ${environment}`
  );

  // Apply configurations
  await task('Applying configurations', () =>
    exec`kubectl apply -f k8s/${environment}/`
  );

  // Scale if needed
  if (options.replicas) {
    await task(`Scaling to ${options.replicas} replicas`, () =>
      exec`kubectl scale deployment/app --replicas=${options.replicas}`
    );
  }

  // Wait for rollout
  if (options.wait) {
    await task('Waiting for rollout', () =>
      exec`kubectl rollout status deployment/app --timeout=5m`
    );
  }

  // Verify deployment
  const pods = await exec`kubectl get pods -l app=myapp -o json`;
  const podData = JSON.parse(pods.output);
  const runningPods = podData.items.filter(
    pod => pod.status.phase === 'Running'
  ).length;

  if (runningPods === options.replicas) {
    yell('DEPLOYMENT SUCCESSFUL!');
    say(`✅ ${runningPods} pods running in ${environment}`);
  } else {
    yell('DEPLOYMENT ISSUES!');
    say(`⚠️ Only ${runningPods}/${options.replicas} pods running`);
  }
}

/**
 * Rollback Kubernetes deployment
 */
export async function kubeRollback(environment = 'staging') {
  const { exec, say, ask } = global.bunosh;

  const confirmed = await ask(
    `Rollback ${environment} deployment?`,
    false
  );

  if (!confirmed) {
    say('Rollback cancelled');
    return;
  }

  await exec`kubectl config use-context ${environment}`;
  await exec`kubectl rollout undo deployment/app`;
  await exec`kubectl rollout status deployment/app`;

  say(`✅ Rolled back ${environment} deployment`);
}
```

### AWS Infrastructure Management

```
bunosh aws:spawn-server --count 3
```

```javascript
/**
 * Spawn EC2 instances and configure
 *
 */
export async function awsSpawnServer(
  instanceType = 't3.micro',
  options = { count: 1, region: 'us-east-1' }
) {
  const { exec, task, say, writeToFile } = global.bunosh;

  const result = await exec`aws ec2 run-instances \
      --image-id ami-0c55b159cbfafe1f0 \
      --instance-type ${instanceType} \
      --count ${options.count} \
      --region ${options.region} \
      --output json`;

  const instanceIds = JSON.parse(result.output).Instances.map(i => i.InstanceId);
  say(`🚀 Launched instances: ${instanceIds.join(', ')}`);

  exec`aws ec2 wait instance-running --instance-ids ${instanceIds.join(' ')}`

  const details = await exec`aws ec2 describe-instances \
    --instance-ids ${instanceIds.join(' ')} \
    --output json`;
  const instances = JSON.parse(details.output).Reservations[0].Instances;

  writeToFile('instances.json', (line) => {
    line`${JSON.stringify(instances, null, 2)}`;
  });

  // Output connection info
  instances.forEach(instance => {
    say(`Instance ${instance.InstanceId}:`);
    say(`  Public IP: ${instance.PublicIpAddress}`);
    say(`  SSH: ssh -i key.pem ec2-user@${instance.PublicIpAddress}`);
  });

  return instances;
}

/**
 * Configure Cloudflare DNS for new servers
 */
export async function cloudflareSetup(domain, ipAddress) {
  const { exec, task, say } = global.bunosh;

  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  await task('Creating DNS record', async () => {
    const result = await exec`curl -X POST \
      "https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records" \
      -H "Authorization: Bearer ${apiToken}" \
      -H "Content-Type: application/json" \
      --data '{
        "type": "A",
        "name": "${domain}",
        "content": "${ipAddress}",
        "ttl": 3600
      }'`;

    return JSON.parse(result.output);
  });

  say(`✅ DNS configured: ${domain} → ${ipAddress}`);
}
```