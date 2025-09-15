const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			index: true,
		},
		type: {
			type: String,
			enum: ["A", "CNAME", "TXT", "AAAA"],
			required: true,
			index: true,
		},
		content: {
			type: String,
			required: true,
		},
		ttl: {
			type: Number,
			default: 3600,
		},
	},
	{ timestamps: true }
);

const Record = mongoose.model("Record", recordSchema);

module.exports = Record;
