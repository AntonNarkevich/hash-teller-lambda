'use strict';

var system = require('system');
var webPage = require('webpage');

//Expecting the labels as command line arguments
if (system.args.length < 2) {
	throw new Error('Labels are not passed');
}
var labels = system.args.slice(1, system.args.length).join(' ');

var page = webPage.create();

//Set up error handlers to see if phantom fails
page.onResourceError = function(resourceError) {
	system.stderr.writeLine('= onResourceError()');
	system.stderr.writeLine(
		'  - unable to load url: "' + resourceError.url + '"'
	);
	system.stderr.writeLine(
		'  - error code: ' +
			resourceError.errorCode +
			', description: ' +
			resourceError.errorString
	);
};
page.onError = function(msg, trace) {
	system.stderr.writeLine('= onError()');
	var msgStack = ['  ERROR: ' + msg];
	if (trace) {
		msgStack.push('  TRACE:');
		trace.forEach(function(t) {
			msgStack.push(
				'    -> ' +
					t.file +
					': ' +
					t.line +
					(t.function ? ' (in function "' + t.function + '")' : '')
			);
		});
	}
	system.stderr.writeLine(msgStack.join('\n'));
};

page.settings.loadImages = false;

page.open('https://displaypurposes.com/', function(status) {
	if (status !== 'success') {
		phantom.exit();

		return;
	}

	//Put the labels into the input field
	page.evaluate(function(labels) {
		var input = document.querySelector('.search-component input');
		input.value = labels;
		//Have to trigger input event to trigger processing
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}, labels);

	//Wait and then copy out the tags
	setTimeout(function() {
		var tags = page.evaluate(function() {
			//Check if at least one tag was generated
			if (!document.querySelector('.copyable-component > div .tag-pack')) {
				return;
			}

			var deepText = function(node) {
				var A = [];
				if (node) {
					node = node.firstChild;
					while (node != null) {
						if (node.nodeType === 3) A[A.length] = node;
						else A = A.concat(deepText(node));
						node = node.nextSibling;
					}
				}
				return A;
			};

			var tagsDiv = document.querySelector('.copyable-component > div');
			var textNodes = deepText(tagsDiv);

			if (!(textNodes && textNodes.length)) {
				return;
			}

			//Unfortunately phantomjs does not support map/filter functions
			//Have to do this via loop
			var tags = [];
			for (var i = 0; i < textNodes.length; i++) {
				var node = textNodes[i];

				if (node && node.nodeValue && node.nodeValue.length > 1) {
					tags.push(node.nodeValue);
				}
			}

			return JSON.stringify(tags);
		});

		system.stdout.write(tags);

		phantom.exit();
	}, 2000);
});
