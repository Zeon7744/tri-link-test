# Update agent-cli.js with new automation commands
$folder = Split-Path $MyInvocation.MyCommand.Path
$path = Join-Path $folder "..\bin\agent-cli.js"

$content = Get-Content $path -Raw -Encoding UTF8

$old = "const requirement = args.filter(a => !a.startsWith('--')).join(' ');"

$new = @"
if (args.includes('--monitor') || args.includes('-M')) {
  const interval = args[args.indexOf('--monitor') + 1] || args[args.indexOf('-M') + 1];
  const ms = interval ? parseInt(interval, 10) * 60 * 1000 : 5 * 60 * 1000;
  agent.monitor.start(ms);
  console.log('[CLI] Monitor started (interval: ' + (ms / 1000 / 60) + 'min). Press Ctrl+C to stop.');
  return;
}

if (args.includes('--monitor-status')) {
  console.log(JSON.stringify(agent.monitor.getReport(), null, 2));
  process.exit(0);
}

if (args.includes('--notify')) {
  const summary = agent.notification.getSummary();
  console.log('');
  console.log('=== Notification Summary ===');
  console.log('Total entries: ' + summary.total);
  console.log('Counts:', JSON.stringify(summary.counts));
  if (summary.byType.length > 0) {
    console.log('');
    console.log('By type:');
    summary.byType.forEach(t => console.log('  ' + t.type + ': ' + t.count));
  }
  process.exit(0);
}

if (args.includes('--retry-failed')) {
  const failed = agent.memory.data.tasks.filter(t => t.status === 'failed');
  if (failed.length === 0) {
    console.log('No failed tasks to retry.');
    process.exit(0);
  }
  console.log('Retrying ' + failed.length + ' failed task(s)...');
  for (const task of failed) {
    task.status = 'pending';
    delete task._retryCount;
    delete task._startedAt;
  }
  agent.memory.save();
  console.log('Tasks re-queued. Use --run to execute them.');
  process.exit(0);
}

"@

if ($content -match [regex]::Escape($old)) {
    $content = $content.Replace($old, $new + $old)
    Set-Content $path -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Updated agent-cli.js, size: $($content.Length)"
} else {
    Write-Host "ERROR: marker not found"
    # Show what's around line 239
    $lines = $content -split "`n"
    for ($i = 235; $i -lt [Math]::Min(245, $lines.Count); $i++) {
        Write-Host "$i : $($lines[$i])"
    }
}
