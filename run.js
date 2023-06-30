import http from "node:http";
import fs from "node:fs";
import config from "./config.js";
import busboy from "busboy";

function index_page(filename_lists) {
	var filenames = filename_lists
		.map(function (f) { return `<li>${f}</li>`; })
		.join("\n");

	var simple_style = `
	body { max-width: 700px; margin: 20px auto; }
	`;

	return `
<!doctype html>
<html>
<head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta charset="utf-8">
	<style>${simple_style}</style>
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
	<ul>${filenames}</ul>
</body>
</html>
  `;
}

function response_index(res) {
	res.writeHead(200, { "Content-Type": "text/html" });
	fs.readdir(config.path, function (err, files) {
		if (!err) res.end(index_page(files));
		else res.end("");
	});
}

function redirect_to_index(res) {
	res.writeHead(302, { "Location": "/" });
	res.end();
}

function file_handler(field_name, file, { filename, encode }) {
	var out_stream = fs.createWriteStream(`${config.path}/${filename}`);
	out_stream.on("error", console.error);
	file.pipe(out_stream);
	console.log(`\treceiving ${filename}...`);
}

function is_multipart(req) {
	return /multipart\/form-data/i.test(req.headers["content-type"]);
}

function base64_decode(encoded_string) {
	return Buffer.from(encoded_string, "base64").toString();
}

function auth_fail(res) {
	res.writeHead(401, {
		"www-authenticate": "Basic realm=\"enter the password\"",
	});
	res.end("");
}

function handler(req, res) {
	if (!req.headers.authorization)
		return auth_fail(res);

	var auth = (req.headers.authorization || "").split(" ")[1] || "";
	var [ username, password ] = base64_decode(auth).split(":");

	if (username != config.username || password != config.password)
		return auth_fail(res);

	if (req.method !== "POST")
		return response_index(res);
	if (!is_multipart(req))
		return redirect_to_index(res);

	var bb = busboy({ headers: req.headers });

	bb.on("finish", function () { redirect_to_index(res); });
	bb.on("file", file_handler);
	req.pipe(bb);
}

http.createServer(handler).listen(config.port);

console.log(`listening on port ${config.port}...`);

