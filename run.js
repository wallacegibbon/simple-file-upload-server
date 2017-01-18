var http = require('http')
var fs = require('fs')
var Busboy = require('busboy')

var PORT = process.argv[2] || 8000
var targetDir = '/tmp/'

var receivedFiles = []


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
`
}

function currentTime() {
  return `${new Date().toISOString()}>`
}

function green(str) {
  return '\033[32m' + str + '\033[0m'
}

function log() {
  console.log.bind(0, green(currentTime())).apply(console, arguments)
}

function responseIndex(res) {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(indexPage())
}

function redirectToIndex(res) {
  res.writeHead(302, { 'Location': '/' })
  res.end()
}

function fileHandler(fieldName, file, filename, encoding, mimitype) {
  var outStream = fs.createWriteStream(`${targetDir}/${filename}`)
  outStream.on('error', e => log(e.message))
  file.pipe(outStream)

  receivedFiles.push(filename)
  log(`receiving ${filename}...`)
}

function isMultipart(req) {
  return /multipart\/form-data/i.test(req.headers['content-type'])
}

function handler(req, res) {
  if (req.method !== 'POST')
    return responseIndex(res)

  if (!isMultipart(req))
    return redirectToIndex(res)

  var bb = new Busboy({ headers: req.headers })

  bb.on('finish', () => redirectToIndex(res))
  bb.on('file', fileHandler)
  req.pipe(bb)
}

http.createServer(handler).listen(PORT)

log(`listening on port ${PORT}...`)

