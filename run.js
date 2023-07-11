import config from "./config.js";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import busboy from "busboy";

function target_path() {
	return path.resolve(process.argv.length >= 3 ? process.argv[2] : config.default_path);
}

function ip_addresses() {
	var entries = Object.entries(os.networkInterfaces());
	function ip_filter({ family, internal }) {
		return family === "IPv4" && !internal;
	}
	var IPs = entries.map(function ([_, address_list]) {
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

function response_index(res) {
	res.writeHead(200, { "Content-Type": "text/html" });
	fs.readdir(target_path(), function (err, files) {
		if (!err) res.end(index_page(files));
		else res.end("");
	});
}

function redirect_to_index(res) {
	res.writeHead(302, { "Location": "/" });
	res.end();
}

function file_handler(_field_name, file, { filename }) {
	var out_stream = fs.createWriteStream(`${target_path()}/${filename}`);
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

console.log(`\tWorking on target directory: ${target_path()}`);
console.log(`\tListening on:`);
for (var addr of ip_addresses())
	console.log(`\t\thttp://${addr}:${config.port} ...`);

http.createServer(handler).listen(config.port);

