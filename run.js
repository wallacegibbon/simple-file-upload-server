const http = require('http');
const fs = require('fs');
const Busboy = require('busboy');

const PORT = process.argv[2] || 8000;
const targetDir = '/tmp';

const receivedFiles = [];


function indexPage() {
  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta charset="utf-8">
</head>
<body>
  <h1>File Upload</h1>
  <form action="/" method="POST" enctype="multipart/form-data">
    <input type="file" name="fileupload">
    <input type="submit" value="transmit">
  </form>
  
  <h2>Transfered Files:</h2>
  <ul>
    ${ receivedFiles.map(f => `<li>${f}</li>`).join('\n') }
  </ul>
</body>
</html>
  `;
}

function prefix() {
  return `\x1b[33m${new Date().toISOString()}>\x1b[0m`;
}

function log() {
  console.log.bind(0, prefix()).apply(console, arguments);
}

function responseIndex(res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(indexPage());
}

function redirectToIndex(res) {
  res.writeHead(302, { 'Location': '/' });
  res.end();
}

function fileHandler(fieldName, file, filename, encoding, mimitype) {
  const outStream = fs.createWriteStream(`${targetDir}/${filename}`);
  outStream.on('error', e => log(e.message));
  file.pipe(outStream);

  log(`Receiving ${filename}...`);
  if (filename) {
    receivedFiles.push(filename);
  }
}

function isMultipart(req) {
  return /multipart\/form-data/i.test(req.headers['content-type']);
}

function handler(req, res) {
  if (req.method !== 'POST') {
    return responseIndex(res);
  }

  if (!isMultipart(req)) {
    return redirectToIndex(res);
  }

  const bb = new Busboy({ headers: req.headers });

  bb.on('finish', () => redirectToIndex(res));
  bb.on('file', fileHandler);
  req.pipe(bb);
}

http.createServer(handler).listen(PORT, () => {
  log(`Listening on port ${PORT}...`);
});

