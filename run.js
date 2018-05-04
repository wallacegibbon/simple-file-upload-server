const http = require('http')
const fs = require('fs')
const Busboy = require('busboy')
const config = require("./config")


function indexPage(files) {
	return `
<!doctype html>
<html>
<head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta charset="utf-8">
	<style>
	body {
		width: 700px;
		margin: 20px auto;
	}
	</style>
</head>
<body>
	<h2>Select File To Upload</h2>
	<hr/>
	<form action="/" method="POST" enctype="multipart/form-data">
		<input type="file" name="fileupload">
		<input type="submit" value="transmit">
	</form>
	<h2>Transfered Files</h2>
	<hr/>
	<ul>
		${ files.map(f => `<li>${f}</li>`).join('\n') }
	</ul>
</body>
</html>
  `
}

function prefix() {
	return `\x1b[33m${new Date().toISOString()}>\x1b[0m`
}

function log() {
	console.log.bind(0, prefix()).apply(console, arguments)
}

function responseIndex(res) {
	res.writeHead(200, { 'Content-Type': 'text/html' })
	fs.readdir(config.path, (err, files) => {
		err ? res.end("") : res.end(indexPage(files))
	})
}

function redirectToIndex(res) {
	res.writeHead(302, { 'Location': '/' })
	res.end()
}

function fileHandler(fieldName, file, filename, encoding, mimitype) {
	const outStream = fs.createWriteStream(`${config.path}/${filename}`)
	outStream.on('error', e => log(e.message))
	file.pipe(outStream)

	log(`Receiving ${filename}...`)
}

function isMultipart(req) {
	return /multipart\/form-data/i.test(req.headers['content-type'])
}

function decodeBase64(string) {
	return new Buffer(string, 'base64').toString()
}

function authFail(res) {
	res.writeHead(401, {
		'WWW-Authenticate': 'Basic realm="enter the password"'
	})
	res.end("")
}

function handler(req, res) {
	if (!req.headers.authorization) {
		return authFail(res)
	}

	const auth = (req.headers.authorization || '').split(' ')[1] || ''
	const [ username, password ] = decodeBase64(auth).split(':')

	if (username != config.username || password != config.password) {
		return authFail(res)
	}

	if (req.method !== 'POST') {
		return responseIndex(res)
	}

	if (!isMultipart(req)) {
		return redirectToIndex(res)
	}

	const bb = new Busboy({
		headers: req.headers
	})

	bb.on('finish', () => redirectToIndex(res))
	bb.on('file', fileHandler)
	req.pipe(bb)
}

http.createServer(handler).listen(config.port, () => {
	log(`Listening on port ${config.port}...`)
})
