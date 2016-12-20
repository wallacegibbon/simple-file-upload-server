var http = require('http')
var fs = require('fs')
var Busboy = require('busboy')

var PORT = 8000
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
  return `${new Date().toTimeString()} -`
}

function log() {
  console.log.bind(null, currentTime()).apply(console, arguments)
}

function respIndex(res) {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(indexPage())
}

function redirectToIndex(res) {
  res.writeHead(302, { 'Location': '/' })
  res.end()
}

function checkMultipart(contentType) {
  return /multipart\/form-data/i.test(contentType)
}

function fileHandler(fieldName, file, filename, encoding, mimitype) {
  var outStream = fs.createWriteStream(`${targetDir}/${filename}`)
  outStream.on('error', e => log('ERROR:', e.message))
  file.pipe(outStream)
  receivedFiles.push(filename)
  log(`receiving ${filename}...`)
}

http.createServer((req, res) => {
  if (req.method !== 'POST')
    return respIndex(res)

  if (!checkMultipart(req.headers['content-type']))
    return redirectToIndex(res)

  var busboy = new Busboy({ headers: req.headers })

  busboy.on('finish', () => redirectToIndex(res))
  busboy.on('file', fileHandler)
  req.pipe(busboy)

}).listen(8000, e => {
  if (!e)
    log(`listening on port ${PORT}...`)
  else
    log('ERROR:', e)
})

