'use strict';

const path = require('path');
const co = require('co');
const Promise = require('bluebird');
const _ = require('lodash');
const AWS = require('aws-sdk');
const execFileAsync = Promise.promisify(require('child_process').execFile);

AWS.config.update({region: process.env['REGION']});
//Setting the path as described here: https://aws.amazon.com/blogs/compute/running-executables-in-aws-lambda/
process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'];

module.exports.generateTags = (event, context, callback) => {
	co(function *() {
		let rekognition = Promise.promisifyAll(new AWS.Rekognition());

		let labelsData = yield rekognition.detectLabelsAsync({
			Image: {
				S3Object: {
					Bucket: 'instagram-hastag-generator',
					Name: event.s3Key
				}
			}
		});

		//Take first five labels joing them like this: 'horse force power'
		let labels = _(labelsData.Labels)
			.take(5)
			.map(d => d.Name)
			.join(' ');

		//Phantom binary
		let phantomPath = path.join(__dirname, 'phantomjs-amazon-linux-executable');
		//Arguments for the phantom script
		let processArgs = [
			path.join(__dirname, 'phantom-script.js'),
			labels
		];

		//Run the process return stdout
		let tagsString = yield execFileAsync(phantomPath, processArgs);
		if (!(tagsString && tagsString.length)) {
			throw new Error('Unable to generate tags');
		}

		return tagsString;
	})
		.then(data => callback(null, data))
		.catch(callback);
};