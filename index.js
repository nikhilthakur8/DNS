const dns = require("native-dns");
const connectToMongoDB = require("./config/db");
const Record = require("./models/record.js");
require("dotenv").config();

connectToMongoDB();

async function handleRequest(request, response) {
	for (const q of request.question) {
		console.log(`DNS Query for ${q.name} type ${q.type}`);

		const parts = q.name.toLowerCase().split(".");
		if (parts.length < 2) continue;

		const zone = parts.slice(-2).join(".");
		const name = parts.slice(0, -2).join(".") || "@";

		const records = await Record.find({ zone, name });

		if (!records || records.length === 0) continue;

		for (const record of records) {
			const fqdn = name === "@" ? zone : `${name}.${zone}`;

			switch (record.type) {
				case "A":
					if (q.type === dns.consts.NAME_TO_QTYPE.A) {
						response.answer.push(
							dns.A({
								name: fqdn,
								address: record.content,
								ttl: record.ttl || 600,
							})
						);
					}
					break;

				case "AAAA":
					if (q.type === dns.consts.NAME_TO_QTYPE.AAAA) {
						response.answer.push(
							dns.AAAA({
								name: fqdn,
								address: record.content,
								ttl: record.ttl || 600,
							})
						);
					}
					break;

				case "CNAME":
					if (q.type === dns.consts.NAME_TO_QTYPE.CNAME) {
						response.answer.push(
							dns.CNAME({
								name: fqdn,
								data: record.content,
								ttl: record.ttl || 600,
							})
						);
					} else if (
						q.type === dns.consts.NAME_TO_QTYPE.A ||
						q.type === dns.consts.NAME_TO_QTYPE.AAAA
					) {
						response.answer.push(
							dns.CNAME({
								name: fqdn,
								data: record.content,
								ttl: record.ttl || 600,
							})
						);

						const targetRecords = await Record.find({
							name: record.content.split(".")[0],
							zone: record.content.split(".").slice(-2).join("."),
							type: { $in: ["A", "AAAA"] },
						});

						targetRecords.forEach((t) => {
							const targetFqdn =
								t.name === "@" ? t.zone : `${t.name}.${t.zone}`;
							if (t.type === "A") {
								response.answer.push(
									dns.A({
										name: targetFqdn,
										address: t.content,
										ttl: t.ttl || 600,
									})
								);
							} else if (t.type === "AAAA") {
								response.answer.push(
									dns.AAAA({
										name: targetFqdn,
										address: t.content,
										ttl: t.ttl || 600,
									})
								);
							}
						});
					}
					break;
				case "TXT":
					if (q.type === dns.consts.NAME_TO_QTYPE.TXT) {
						response.answer.push(
							dns.TXT({
								name: fqdn,
								data: record.content,
								ttl: record.ttl || 600,
							})
						);
					}
					break;

				default:
					break;
			}
		}
	}

	response.send();
}

// Create UDP server
const udpServer = dns.createUDPServer();
udpServer.on("request", handleRequest);
udpServer.on("error", (err) => console.error("UDP error:", err));
udpServer.serve(53);

// Create TCP server
const tcpServer = dns.createTCPServer();
tcpServer.on("request", handleRequest);
tcpServer.on("error", (err) => console.error("TCP error:", err));
tcpServer.serve(53);

console.log("DNS server running on UDP & TCP port 53");
