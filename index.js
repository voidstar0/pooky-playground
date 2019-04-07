const inquirer = require('inquirer')
const axios = require('axios')
var express = require('express');
var app = express();
const fs = require('fs');
const path = require('path')
const beautify = require('js-beautify').js
const esprima = require('esprima')

const PORT = process.env.PORT || 80;

app.engine('ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/assets', express.static('assets'));

const loadFrom = async () => {
	const locationQuestion = [{
	  type: 'list',
	  name: 'choice',
	  message: 'What do you want to do?',
	  choices: ['Load from file', 'Load from URL'],
	  filter: (val) => val.toLowerCase()
	}]

	const location = await inquirer.prompt(locationQuestion)
	if(location.choice === 'load from file') {
		const files = fs.readdirSync(path.join(__dirname, 'assets'));
		const fileQuestion = [{
		  type: 'list',
		  name: 'choice',
		  message: 'Which pooky version would you like to use?',
		  choices: files,
		  filter: (val) => val.toLowerCase()
		}]
		const useFile = await inquirer.prompt(fileQuestion)
		return {type: 'file', location: useFile.choice}
	} else {
		const pookyQuestion = [{
		  type: 'input',
		  name: 'url',
		  message: "Enter the Pooky URL",
		}]
		const pooky = await inquirer.prompt(pookyQuestion)

		const tohruQuestion = [{
		  type: 'input',
		  name: 'value',
		  message: "Enter the Pooky Tohru",
		}]
		const tohru = await inquirer.prompt(tohruQuestion)

		return {type: 'url', location: pooky.url, tohru: tohru.value}
	}
}

const isDateCheck = (node) => {
	return (
		node.type === 'ExpressionStatement' &&
		node.expression.type === 'AssignmentExpression' &&
		node.expression.left &&
		node.expression.left.type === 'Identifier' &&
		node.expression.right &&
		node.expression.right.type === 'ConditionalExpression' &&
		node.expression.right.test &&
		node.expression.right.test.left &&
		node.expression.right.test.left.callee &&
		node.expression.right.test.left.callee.object &&
		node.expression.right.test.left.callee.object.name === 'Math'

	)
}

const fetchPookyFromURL = async (url) => {
	const res = await axios.get(url)
	let formattedPooky = beautify(res.data, { indent_size: 2, space_in_empty_paren: true, unescape_strings: true })
	let finalFormattedPooky = formattedPooky;
	esprima.parseScript(formattedPooky, {range: true}, function (node, meta) {
        if (isDateCheck(node)) {
        	const identifier = node.expression.left.name
        	const line = formattedPooky.substring(meta.start.offset, meta.end.offset)

        	let path = line.substring(line.indexOf('?') + 1, line.indexOf(':') - 1)
        	finalFormattedPooky = finalFormattedPooky.replace(line, `${identifier} = ${path};`)
            console.log("Found Date Check with identifier: " + identifier)
            console.log("Path: " + path)
        }
    });

	return finalFormattedPooky;
}

loadFrom().then(res => {
	if(res.type === 'url') {
		fetchPookyFromURL(res.location).then(pooky => {
			const fileName = path.join(__dirname, 'assets', res.location.substr(res.location.indexOf('pooky.min.')));
			fs.writeFile(fileName, pooky, (err) => {
			  if (err) throw err;
			})
			const tohru = res.tohru
			app.get('/', function(req, res) {
			    res.render('index', {
			        pooky: fileName,
			        tohru: tohru
			    });
			});
			app.listen(80);
			console.log('Server started on PORT 80. (Make sure you edit host file)');
		})
	} else {

	}
}).catch(err => {
	switch (err.code) {
		case 'ENOENT':
			console.error(`Error: The file or directory ${err.path} does not exist, please create the file or directory.`);
			break;
		default:
			throw err;
	}
})