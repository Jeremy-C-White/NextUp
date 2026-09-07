import express from 'express';
const app = express();
app.get('/test', (req, res) => {
  req.on('close', () => console.log('req closed'));
  setTimeout(() => {
    console.log('sending response');
    res.json({ok: true});
  }, 1000);
});
app.listen(3001, () => console.log('started'));
