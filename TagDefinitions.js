//TODO: Add conversion function for new BBCode to turn into old BBCode and vice versa (e.g. progress to number)
//^I don't think any current tags need it, but we definitely need to keep this in mind for backwards-compatibility with future tags.
function isParentCorrect(restrictParentsTo, currentNode){
	return restrictParentsTo.includes(currentNode.parentNode.tag)
}
function isInt(value) {
  return !isNaN(value) && 
         parseInt(Number(value)) == value && 
         !isNaN(parseInt(value, 10));
}
//WARNING WARNING THIS FUNCTION IS NODE-AWARE
function isEmbeddedTable(baseNode){
	testNode = baseNode
	while(testNode.parentNode){							//Until we get to the root node
		testNode = testNode.parentNode
		if(testNode.tagMatchesSelf('table')){			//If one of our parents is a table
			return true
		}
	}
	return false
}
//TODO: Clean up parameters. tagStack and errorQueue have now been deprecated.
function validateURL(url){
	urlPattern.lastIndex = 0
	let result = urlPattern.test(url)
	urlPattern.lastIndex = 0							//Let's reset to be nice to the next guy!
	return result
}

function extractYoutubeId(url) {
    var re = /^.*(?:youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([A-Za-z0-9_\-]{11}).*/
    var match = url.match(re)
    return match && match[1]
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}
var colorNamePattern = /^(?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)$/
var colorCodePattern = /^#?[a-fA-F0-9]{6}$/
var fontFacePattern = /^([a-z][a-z0-9_\s]+)$/i
var colorSpec = {
	//WARNING: THIS FUNCTION IS NODE-AWARE
	openTag: function(params, content, tagStack, errorQueue) {
		this.isValidColor = false				//Set default value of color node
		// Ensure they gave us a colorCode
		if (!params) {
			TreeNode.pushError('You have a COLOR tag that does not specify a color')
			this.isValidColor = false
			//Injecting validity attribute into node (I'm really happy these can interact with the node hierarchy now)
			return '&#91;color&#93;' + content
		}

		var colorCode = params.toLowerCase()

		// Ensure colorCode is actually a color
		colorNamePattern.lastIndex = 0
		colorCodePattern.lastIndex = 0
		if (
			!colorNamePattern.test(colorCode) &&
			!colorCodePattern.test(colorCode)
		) {
			TreeNode.pushError('You have a COLOR tag with an invalid color: ' +
					'[color=' +
					params +
					']'
			)
			this.isValidColor = false
			//Injecting validity attribute into node
			return '&#91;color=' + params + '&#93;' + content
		}

		// If colorCode is a hex value, prefix it with # if it's missing
		colorCodePattern.lastIndex = 0
		if (
			colorCodePattern.test(colorCode) &&
			colorCode.substr(0, 1) !== '#'
		) {
			colorCode = '#' + colorCode
		}
		this.isValidColor = true
		//Injecting validity attribute into node
		//False indicating that this color tag is not invalid
		return '<font color="' + colorCode + '">' + content
	},
	closeTag: function(params, content, tagStack, errorQueue) {
		return this.isValidColor ? '</font>' : '&#91;/color&#93;'
		//We do have to ensure this.isValidColor is set by the opener function
	},
}

var centerSpec = {
	trimContents: true,
	openTag: function(params, content) {
		return '<div class="bb-center">'
	},
	closeTag: function(params, content) {
		return '</div>'
	},
}

var singleTags = {
	hr: {
		openTag: function(params, content) {
			return '<hr class="bb-hr">'
		}
	},
	br: {
		openTag: function(params, content) {
			return '<br>'
		}
	},
	legend: {
		openTag: function(params, content) {
			const innerLink = params ? params : 'LegendBegins'
			return ('<a target="_blank" rel="nofollow noopener" href="https://YouTube.com/LegendBegins">' + innerLink + '</a>')
		},
	}
}

var stopTags = {												//We don't allow new stoptags YET, sadly. TODO: Replace new stoptags with raw BBCode for any posts that contain a custom stoptag, and do logic processing with back and forth.
	code: {
		openTag: function(params, content) {
			return '<code>' + content
		},
		closeTag: function(params, content) {
			return '</code>'
		},
	},
	pre: {
		trimContents: true,
		openTag: function(params, content) {
			return '<pre>' + content
		},
		closeTag: function(params, content) {
			return '</pre>'
		}
	},
	 img: {														//Edge case where images with BBCode in URL won't be handled properly, but that needs to be fixed Guild-side
		openTag: function(params, content) {
			var myUrl = content.trim()

			if (!validateURL(myUrl)) {
				myUrl = ''
			}

			return '<img src="' + escapeHtml(myUrl) + '" />'	//Do we really need to escape? Don't we already escape HTML?
		},
		closeTag: function(params, content) {
			return ''
		},
	},
	noparse: {
            openTag: function(params, content) {
                return content
            },
            closeTag: function(params, content) {
                return ''
            },
        },
	 youtube: {													//TODO: Figure out how to engineer this system in such a way that this can decide whether or not it wants to act like a stoptag.
		openTag: function(params, content, tagStack, errorQueue) {	//Cont. I think we could make these all functions that are adopted and called by the node class, with knowledge of internal node structure.
			var youtubeId = extractYoutubeId(content)			//Cont. Most can stay the same, but the few that need context of the underlying hierarchy can do their thing without the jank.
			if (!youtubeId){									//Cont. Maybe that would let us optimize out stoptags too...? Eh, probably not. BBCode errors are generated while parsing, and stoptags need to know they shouldn't gen errors.
				TreeNode.pushError('The video URL appears to be invalid')
				return '&#91;youtube&#93;' + content +' &#91;/youtube]'
			}
			var src = 'https://youtube.com/embed/' + youtubeId + '?theme=dark'
			return (
				'<iframe src="' +
				src +
				'" frameborder="0" width="496" height="279" allowfullscreen></iframe>'
			)
		},
		closeTag: function(params, content) {
			return ''
		},
	},
}

var tags = {
	//
	// Custom BBCode for the Guild
	//
	//Had to move this from singletags. Problem for another day: We can't easily convert from custom singletags to normal, visible BBCode. Because single tags have no invisible endtag,
	//We have no way to figure out what data belongs to the singletag vs. was originally on the page (e.g. a progress bar converts to a number for non-extension users. How do we see the number and convert back to the progress bar?)
	//We could wrap it in the traditional start/end tags and then convert it back to a singletag after processing and before handing it to our node class, so it's transparent, which is probably the best solution.
	//But let's cross that bridge when we have real singletags that we really want to implement.
	progress: {
		 openTag: function(params, content) {
			if(isInt(content)){
				return ('<progress max="100" value="' + content + '"></progress>')
			}
			TreeNode.pushError('Progress must be a number.')
			return content
		},
		closeTag: function(params, content) {
			return ''
		},
	},
	hider: {
		trimContents: true,
		openTag: function(params, content) {
			var title = params ? escapeHtml(params) : 'Hider'												//Again, do we need this, since we escape earlier?
			return (
				'<div class="hider-panel">' +
				'<div class="hider-heading">' +
				'<button type="button" class="btn btn-default btn-xs hider-button" data-name="' +
				title +
				'">' +
				// title + ' [+]'+
				//Using html entity code for bracket
				title +
				' &#91;+&#93;' +
				'</button>' +
				'</div>' +
				'<div class="hider-body" style="display: none">' + content
			)
		},
		closeTag: function(params, content) {
			return '</div></div>'
		},
	},
	abbr: {
		openTag: function(params, content) {
			return (
				'<abbr class="bb-abbr" title="' +
				(params) +
				'">' + content
			)
		},
		closeTag: function(params, content) {
			return '</abbr>'
		},
	},
	mark: {
		openTag: function(params, content) {
			return '<span class="bb-mark">' + content
		},
		closeTag: function(params, content) {
			return '</span>'
		}
	},
	 indent: {
		trimContents: true,
		openTag: function(params, content) {
			return '<div class="bb-indent">' + content
		},
		closeTag: function(params, content) {
			return '</div>'
		},
	},
	h1: {
		trimContents: true,
		openTag: function(params, content) {
			return '<div class="bb-h1">' + content
		},
		closeTag: function(params, content) {
			return '</div>'
		},
	},
	h2: {
		trimContents: true,
		openTag: function(params, content) {
			return '<div class="bb-h2">' + content
		},
		closeTag: function(params, content) {
			return '</div>'
		},
	},
	h3: {
		trimContents: true,
		openTag: function(params, content) {
			return '<div class="bb-h3">' + content
		},
		closeTag: function(params, content) {
			return '</div>'
		},
	},
	b: {
		openTag: function(params, content) {
			return '<span class="bb-b">' + content
		},
		closeTag: function(params, content) {
			return '</span>'
		}
	},
	center: centerSpec,
	centre: centerSpec,
	color: colorSpec,
	colour: colorSpec,
	font: {
	   openTag: function(params,content) {

		 var faceCode = params || "inherit";
		 fontFacePattern.lastIndex = 0;
		 if ( !fontFacePattern.test( faceCode ) ) {
		   faceCode = "inherit";
		 }
		 return '<span style="font-family:' + faceCode + '">' + content;
	   },
	   closeTag: function(params,content) {
		 return '</span>';
	   }
	 },
	i: {
		openTag: function(params, content) {
			return '<span class="bb-i">' + content
		},
		closeTag: function(params, content) {
			return '</span>'
		},
	},
	justify: {
		trimContents: true,
		openTag: function(params, content) {
			return '<div class="bb-justify">' + content
		},
		closeTag: function(params, content) {
			return '</div>'
		},
	},
	left: {
	   openTag: function(params,content) {
		 return '<div class="bb-left">' + content;
	   },
	   closeTag: function(params,content) {
		 return '</div>';
	   }
	 },
	list: {
		openTag: function(params, content) {
			return '<ul class="bb-list" style="white-space: normal;">' + content
		},
		closeTag: function(params, content) {
			return '</ul>'
		},
	},
	quote: {
		trimContents: true,
		openTag: function(params, content) {
			return '<blockquote class="bb-quote">' + content
		},
		closeTag: function(params, content) {
			var html = ''
			if (params) {
				// params starts with '=' unless user messed up.
				// e.g. '=@Mahz' or '=some guy'
				if (
					params.charAt(0) === '@' &&
					params.length > 1
				) {
					// This is a @uname mention
					var uname = params.slice(1)
					html += '<footer>[@' + uname + ']</footer>'
				} else {
					var source = params
					html += '<footer>' + source + '</footer>'
				}
			}
			html = html + '</blockquote>'
			return html
		},
	},
	right: {
		trimContents: true,
		openTag: function(params, content) {
			return '<div class="bb-right">' + content
		},
		closeTag: function(params, content) {
			return '</div>'
		},
	},
	s: {
		openTag: function(params, content) {
			return '<span class="bb-s">' + content
		},
		closeTag: function(params, content) {
			return '</span>'
		},
	},
	 sub: {
		openTag: function(params, content) {
			return '<sub>' + content
		},
		closeTag: function(params, content) {
			return '</sub>'
		},
	},
	sup: {
		openTag: function(params, content) {
			return '<sup>' + content
		},
		closeTag: function(params, content) {
			return '</sup>'
		},
	},
	table: {
		openTag: function(params, content, tagStack, errorQueue) {
			let restrictParentsTo = ['cell']
			
			if(isEmbeddedTable(this) && !isParentCorrect(restrictParentsTo, this)){
				//If this is a nested table
				//If the parent isn't a cell, don't try to nest the table (Note: overriding this CAN break HTML)
				TreeNode.pushError('The only acceptable parents of a nested table include: ' + restrictParentsTo)
				//We didn't open a table with this one
				return ''
			}
			if (params === 'bordered')
				return '<div class="table-responsive"><table class="bb-table table table-bordered">' + content
			return '<div class="table-responsive"><table class="bb-table table">' + content
		},
		closeTag: function(params, content) {
			let restrictParentsTo = ['cell']
			if(isEmbeddedTable(this) && !isParentCorrect(restrictParentsTo, this)){
				//If the table is embedded and parent is wrong, we don't have any end tags
				return ''
			}
			return '</table></div>'
		},
	},
	cell: {
		openTag: function(params, content, tagStack, errorQueue) {
			restrictParentsTo = ['row']
			
			if(!isParentCorrect(restrictParentsTo, this)){
				TreeNode.pushError('The only acceptable parents of the tag \'cell\' include: ' + restrictParentsTo)
				return '<td>' + content
			}

			var classNames = [''],
				status
			// Determine the status if one is given.
			switch (params) {
				case 'active':
					status = 'active'
					break
				case 'success':
					status = 'success'
					break
				case 'warning':
					status = 'warning'
					break
				case 'danger':
					status = 'danger'
					break
				case 'info':
					status = 'info'
					break
				default:
					break
			}
			classNames.push('bb-td')
			if (status)
				classNames = classNames.concat([status, 'bb-' + status])
			
			//NOTE: If you want to automate th and thead, you need to account for nested tables.
			//However, I don't really think they should be auto-th because users should be able to stylize tables how they want
			//if (isFirstTableRow) return '<th class="bb-th">'
			return '<td class="' + classNames.join(' ') + '">' + content
		},
		closeTag: function(params, content) {
		   // if (isFirstTableRow) return '</th>'
			return '</td>'
		},
	},
	row: {
		openTag: function(params, content, tagStack, errorQueue) {  
			restrictParentsTo = ['table']		
			
			if(!isParentCorrect(restrictParentsTo, this)){
				TreeNode.pushError('The only acceptable parents of the tag \'row\' include: ' + restrictParentsTo)
				return '<tr>' + content
			}/*
			if (isFirstTableRow) {
				return '<thead class="bb-thead"><tr class="bb-tr">'
			}*/
			var classNames = [''],
				status
			// Determine the status if one is given.
			switch (params) {
				case 'active':
					status = 'active'
					break
				case 'success':
					status = 'success'
					break
				case 'warning':
					status = 'warning'
					break
				case 'danger':
					status = 'danger'
					break
				case 'info':
					status = 'info'
					break
				default:
					break
			}
			classNames.push('bb-tr')
			if (status)
				classNames = classNames.concat([status, 'bb-' + status])
			return '<tr class="' + classNames.join(' ') + '">' + content
		},
		closeTag: function(params, content) {
			/*if (isFirstTableRow) html = '</tr></thead>'
			else html = '</tr>'
			isFirstTableRow = false*/
			return '</tr>'
		},
	},
	u: {
		openTag: function(params, content) {
			return '<span class="bb-u">' + content
		},
		closeTag: function(params, content) {
			return '</span>'
		},
	},
	'*': {    
		openTag: function(params, content, tagStack, errorQueue) {
			restrictParentsTo = ['list'] //, 'ul', 'ol'], These are now unused
			if(!isParentCorrect(restrictParentsTo, this)){
				TreeNode.pushError('The only acceptable parents of the tag \'*\' include: ' + restrictParentsTo)
				return '<tr>' + content
			}
			//Return li no matter what
			return '<li>' + content
		},
		closeTag: function(params, content) {
			return '</li>'
		},
		
	},
	marquee: {
		 openTag: function(params, content) {
			return '<marquee scrollamount=' + params + '>' + content
		},
		closeTag: function(params, content) {
			return '</marquee>'
		}
	},
	glow: {
		 openTag: function(params, content) {
			return '<span class="glow">' + content
		},
		closeTag: function(params, content) {
			return '</span>'
		}
	},
	url: {
		openTag: function(params, content) {								//Rare instance where content will be useful to us... and why we needed this rewrite to begin with >=D
			let url = 'https://www.roleplayerguild.com'						//Initialize to something safe
			if(params){
				url = params.trim()
			}
			else{
				url = content.trim()
			}
			
			if (url.indexOf('http://') !== 0) {								//If they don't provide HTTP/HTTPS protocol, we link to HTTPS
				url = 'https://' + url
			}
			if (!validateURL(url)){
				TreeNode.pushError('Invalid URL Provided')					//TODO: Highlight these for the user!
				url = 'https://www.roleplayerguild.com'						//If URL validation fails, we go back to linking to RPG by default
			}
			
			
			if (/^((https?:\/\/)?(www\.)?roleplayerguild\.com)/i.test(url)) {
				//Internal link
				return '<a href="' + url + '">' + content
			} 
			else {
				//External link
				return (
					'<a target="_blank" rel="nofollow noopener" href="' +
					url +
					'">' + content
				)
			}

		},
		closeTag: function(params, content) {
			return '</a>'
		}
	}
}

//I don't really like this way of doing it, but it's what Guild proper uses, so...
let urlPattern = new RegExp(
	'^' +
		// protocol identifier
		'(?:(?:https?|ftp)://)' +
		// user:pass authentication
		'(?:\\S+(?::\\S*)?@)?' +
		'(?:' +
		// IP address exclusion
		// private & local networks
		'(?!(?:10|127)(?:\\.\\d{1,3}){3})' +
		'(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})' +
		'(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})' +
		// IP address dotted notation octets
		// excludes loopback network 0.0.0.0
		// excludes reserved space >= 224.0.0.0
		// excludes network & broacast addresses
		// (first & last IP address of each class)
		'(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
		'(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
		'(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
		'|' +
		// host name
		'(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' +
		// domain name
		'(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' +
		// TLD identifier
		'(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' +
		')' +
		// port number
		'(?::\\d{2,5})?' +
		// resource path
		'(?:/\\S*)?' +
		'$',
	'i'
)