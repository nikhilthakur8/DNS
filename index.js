const dns = require("native-dns");
const server = dns.createServer();
const connectToMongoDB = require("./config/db");
const Record = require("./models/Record");
require("dotenv").config();
connectToMongoDB();
server.on("request", async function (request, response) {
	for (const q of request.question) {
		console.log("DNS Query for " + q.name);

		// Find either A or CNAME record for that name
		let record = await Record.findOne({ name: q.name });

		if (!record) continue;
		console.log(request.question);
		if (record.type === "A" && q.type === dns.consts.NAME_TO_QTYPE.A) {
			response.answer.push(
				dns.A({
					name: record.name,
					address: record.content,
					ttl: record.ttl || 600,
				})
			);
		} else if (record.type === "CNAME") {
			response.answer.push(
				dns.CNAME({
					name: record.name,
					data: record.content, // "data" must be the CNAME target
					ttl: record.ttl || 600,
				})
			);

			// Optional: look up the target of the CNAME in DB and return its A record too
			const target = await Record.findOne({
				name: record.content,
				type: "A",
			});
			if (target) {
				response.answer.push(
					dns.A({
						name: target.name,
						address: target.content,
						ttl: target.ttl || 600,
					})
				);
			}
		}
	}
	response.send();
});

server.serve(53);
