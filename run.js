import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import busboy from "busboy";
import * as commander from "commander";

/// the global variable that holds all configurations (like path, port, username, ...)
var config = {};

function ip_addresses() {
	function ip_filter({ family, internal }) {
		return family === "IPv4" && !internal;
	}
	var IPs = Object.entries(os.networkInterfaces()).map(function ([_, address_list]) {
		return address_list.filter(ip_filter);
	});
	return Array.prototype.concat(...IPs).map(function ({ address }) {
		return address;
	});
}

function index_page(filename_lists) {
	return `
<!doctype html>
<html>
<head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta charset="utf-8">
	<style>
body { max-width: 600px; margin: 20px auto; padding: 10px; }
ul { padding: 0; }
li { list-style: none; word-wrap: break-word; }
li::before { content: ">"; color: steelblue; margin-right: 2px; }
#form { display: flex; }
#form>input:first-child { flex: 1; }
	</style>
</head>

<body>
	<form id="form" action="/" method="POST" enctype="multipart/form-data">
		<input type="file" name="fileupload">
		<input type="submit" value="transmit">
	</form>
	<ul>
	${filename_lists.map(function (f) { return `<li>${f}</li>`; }).join("\n")}
	</ul>
</body>
</html>
	`;
}

async function response_index(res) {
	res.writeHead(200, { "Content-Type": "text/html" });
	try {
		var files = await fs.promises.readdir(config.path);
		res.end(index_page(files));
	} catch (err) {
		res.end("");
	}
}

function redirect_to_index(res) {
	res.writeHead(302, { "Location": "/" });
	res.end();
}

function file_handler(_field_name, file, { filename }) {
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
	res.writeHead(401, { "www-authenticate": "Basic realm=\"enter the password\"" });
	res.end("");
}

function get_user_from_request(req) {
	if (!req.headers.authorization) return null;

	var auth = (req.headers.authorization || "").split(" ")[1] || "";
	var [ username, password ] = base64_decode(auth).split(":");

	return { username, password };
}

function handler(req, res) {
	var user = get_user_from_request(req);
	if (!user) return auth_fail(res);
	if (user.username != config.username) return auth_fail(res);
	if (user.password != config.password) return auth_fail(res);

	if (req.method !== "POST") return response_index(res);
	if (!is_multipart(req)) return redirect_to_index(res);

	var bb = busboy({ headers: req.headers });

	bb.on("finish", function () { redirect_to_index(res); });
	bb.on("file", file_handler);
	req.pipe(bb);
}

function show_startup_info() {
	console.log(`\tWorking on target directory: ${path.resolve(config.path)}`);
	console.log(`\tListening on:`);
	for (var addr of ip_addresses())
		console.log(`\t\thttp://${addr}:${config.port} ...`);
}

commander.program
	.name("simple-file-upload-server")
	.description("A simple HTTP server for uploading files")
	.option("--port <number>", "The TCP port this server listens to", "8080")
	.option("--path <path>", "The path this server serves", "/tmp")
	.option("--username <string>", "The username", "wallace")
	.option("--password <string>", "The password", "blahblah")
	.action(function (args) {
		config = args;
		http.createServer(handler).listen(Number(config.port));
		show_startup_info();
	})
	.parse();

