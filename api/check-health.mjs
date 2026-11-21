let ready = false;
for (let attempt = 0; attempt < 15; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const body = await response.json();
    if (response.ok && body.status === 'ok' && body.database === 'connected') {
      ready = true;
      break;
    }
  } catch { /* Wait for service startup. */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) {
  console.error('API ou banco indisponível. Consulte: sudo journalctl -u nutraining-api.service -n 50 --no-pager');
  process.exit(1);
}
console.log('API disponível; PostgreSQL conectado.');
