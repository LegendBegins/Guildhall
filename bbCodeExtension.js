
//TODO: Replace regex exec with something like match

var newTagList = ['font', 'br', 'legend', 'left', 'marquee', 'glow', 'progress']								//ADD NEW TAGS HERE! They'll be pre-parsed before being passed to the normal posthandler, so these should never end up being treated as normal tags. This allows us to keep both normal and custom tags in the same object
newEditButton()																									//Safe to show on any page...? TODO: VERIFY
newPostButton()																									//Safe to show on any page...? TODO: VERIFY
newBioButton()																									//Pretty sure these are all safe because of AJAX stuff
var XBBCODE = bbCodeHandler()																					//Setting page variables...
XBBCODE.processAllPosts()


var util, cache

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}


// This function is intended to prevent the Reply button from including
// nested quote contents.
//
// aaa
// [quote=outer]
// hello
// [quote=inner]
// :)
// [/quote]
// bye
// [/quote]
// zzz
//
// becomes...
//
// aaa
// <Snipped quote by outer>
// zzz
//
//
// Given a post's markup, it replaces nested quotes with
// <Snipped quote by {{ uname }}> or <Snipped quote>
// The returned string is then ready to be wrapped with [quote=@...][/quote]
// and placed in the editor

function extractTopLevelMarkup(markup) {
    var re = /\[(quote)=?@?([a-z0-9_\- ]+)?\]|\[(\/quote)\]/gi
    // A quoteStack item is { idx: Int, uname: String | undefined }
    var quoteStack = []

    // match[1] is 'quote' (opening quote tag)
    // match[2] is 'uname' of [quote=uname]. Only maybe present when match[1] exists
    // match[3] is '/quote' (closing quote)
    while (true) {
        var match = re.exec(markup)
        if (!match) {
            break
        } else {
            if (match[1]) {
                // Open quote tag
                var uname = match[2] // String | undefined
                quoteStack.push({ idx: match.index, uname: uname })
            } else if (match[3]) {
                // Close quote tag
                // - If there's only 1 quote on the quoteStack, we know this is a top-level
                //   quote that we want to replace with '<Snip>'
                // - If there are more than 1 quote on the stack, then just pop() and loop.
                //   Means we're in a nested quote.
                // - If quoteStack is empty just loop
                if (quoteStack.length > 1) {
                    quoteStack.pop()
                } else if (quoteStack.length === 1) {
                    //debug(match.input);
                    var startIdx = quoteStack[0].idx
                    var endIdx = match.index + '[/quote]'.length
                    var quote = quoteStack.pop()
                    var newMarkup =
                        match.input.slice(0, startIdx) +
                        (quote.uname
                            ? '<Snipped quote by ' + quote.uname + '>'
                            : '<Snipped quote>') +
                        match.input.slice(endIdx)

                    markup = newMarkup
                    re.lastIndex = re.lastIndex - (endIdx - startIdx)
                }
            }
        }
    }

    return markup
}

// Keep in sync with BBCode cheatsheet
var smilies = [
    'airquotes',
    'airquote',
    'arghfist',
    'bow',
    'brow',
    'btw',
    'cool',
    'dreamy',
    'drool',
    'gray',
    'confused',
    'magnum',
    'nat',
    'hehe',
    'lol',
    'hmm',
    'golfclap',
    'ou',
    'newlol',
    'punch',
    'rock',
    'respek',
    'rollin',
    'rolleyes',
    'sick',
    'sun',
    'toot',
    'usa',
    'wub',
    'what',
    'zzz',
]
var smilieRegExp = new RegExp(':(' + smilies.join('|') + ')', 'ig')

function replaceSmilies(text) {
    return text.replace(smilieRegExp, '<img src="/smilies/$1.gif">')
}

var greenTextRegExp = /^((?:<[^>]+>)*)(&gt;\S.*)$/gm
function replaceGreenText(text) {
    return text.replace(
        greenTextRegExp,
        '$1<span class="bb-greentext">$2</span>'
    )
}
/*
function replaceHr(text) {
    return text.replace(/&#91;hr&#93;/g, '<hr class="bb-hr">')
}
*/
// Replace unames

function replaceMentions(text) {
    function slugifyUname(uname) {
        return uname
            .trim()
            .toLowerCase()
            .replace(/ /g, '-')
    }
    return text.replace(/\[@([a-z0-9_\- ]+)\]/gi, function(_, p1) {
        var uname = p1.trim()
        var path = '/users/' + slugifyUname(uname)

		// If we're on the browser, just render anchor every time
		// TODO: Only render mentions in browser is uname exists in DB
		return (
			'<a class="bb-mention" href="' + path + '">@' + uname + '</a>'
		)
    })
}


function bbCodeHandler() {
    ////
    //// Here are some nasty global variables that let me add in some stateful
    //// hacks until I have time to find better ways to do these things.
    ////
    //
    // Global tabIdx cursor so that [tab] context knows when it's first
    // in the array of [tabs] children.
    //var tabIdx = 0
    // Only true for the first [row] parsed within a [table]
    // This lets me wrap the first [row] with a <thead>
    //Note: I have removed thead because I think that content is better suited with users deciding header styling
    //If you think they should stay, please create an issue explaining why
    //var isFirstTableRow = true


/*
    function generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(
            c
        ) {
            var r = (Math.random() * 16) | 0,
                v = c == 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
        })
    }
*/
    // -----------------------------------------------------------------------------
    // Set up private variables
    // -----------------------------------------------------------------------------

    var me = {},
        // This library's default:
        //urlPattern = /^[-a-z0-9:;@#%&()~_?\+=\/\\\.]+$/i,

        // https://mathiasbynens.be/demo/url-regex
        // Source from https://gist.github.com/dperini/729294
        urlPattern = new RegExp(
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
        ),
        colorNamePattern = /^(?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)$/,
        colorCodePattern = /^#?[a-fA-F0-9]{6}$/,
        emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/,
        fontFacePattern = /^([a-z][a-z0-9_\s]+)$/i,
        tags,
        tagList,
        tagsNoParseList = [],
        bbRegExp,
        pbbRegExp,
        pbbRegExp2,
        openTags,
        closeTags

    /* -----------------------------------------------------------------------------
   * tags
   * This object contains a list of tags that your code will be able to understand.
   * Each tag object has the following properties:
   *
   *   openTag - A function that takes in the tag's parameters (if any), its
   *             contents, the current tag stack (with structure [tag, contents],
   *             and the error queue and returns what its HTML open tag should be.
   *             Example: [color=red]test[/color] would take in "red" as a
   *             parameter input, and "test" as a content input.
   *             It should be noted that any BBCode inside of "content" will have
   *             been processed by the time it enter the openTag function.
   *
   *   closeTag - A function that takes in the tag's parameters (if any) and its
    *              contents, the current tag stack (with structure {tag, tagData},
   *              and the error queue and returns what its HTML close tag should be.
   *
   *
   * LIMITIONS on adding NEW TAGS:
   *  - Tag names cannot start with an @.
   *  - If a tag's content is not supposed to be parsed, add it to the stopTag dictionary
   *  - If a tag has no closing counterpart (e.g. [hr]), add it to the singleTag dictionary
   *  - If a tag has a standard open and close tag structure, add it to the tags dictionary
   *  - Allowing tags to inject additional raw BBCode is unsupported. Attempt at your own risk
   * --------------------------------------------------------------------------- */

    // Extracting BBCode implementations makes it simpler to create aliases
    // like color & colour -> colorSpec
    

    var makeUnique = function(a) {
        var seen = {};
        return a.filter(function(item) {
            return seen.hasOwnProperty(item) ? false : (seen[item] = true);
        });
    }

//		blockquote: {																									//Disabled until fixed
//			 openTag: function(params, content) {
//                return ('<blockquote cite="' + params + '">')
 //           },
 //           closeTag: function(params, content) {
//                return ('</blockquote><figcaption><cite>' + params + '</cite></figcaption>')
//            }
//		},


    /*
    The star tag [*] is special in that it does not use a closing tag. Since this parser requires that tags to have a closing
    tag, we must pre-process the input and add in closing tags [/*] for the star tag.
    We have a little leverage in that we know the text we're processing wont contain the <> characters (they have been
    changed into their HTML entity form to prevent XSS and code injection), so we can use those characters as markers to
    help us define boundaries and figure out where to place the [/*] tags.
  */
    function fixStarTag(text) {
        text = text.replace(
            /\[(?!\*[ =\]]|list([ =][^\]]*)?\]|\/list[\]])/gi,
            '<'
        )
        text = text.replace(/\[(?=list([ =][^\]]*)?\]|\/list[\]])/gi, '>')

        while (
            text !==
            (text = text.replace(
                />list([ =][^\]]*)?\]([^>]*?)(>\/list])/gi,
                function(matchStr, contents, endTag) {
                    var innerListTxt = matchStr
                    while (
                        innerListTxt !==
                        (innerListTxt = innerListTxt.replace(
                            /\[\*\]([^\[]*?)(\[\*\]|>\/list])/i,
                            function(matchStr, contents, endTag) {
                                if (endTag.toLowerCase() === '>/list]') {
                                    endTag = '</*]</list]'
                                } else {
                                    endTag = '</*][*]'
                                }
                                return '<*]' + contents + endTag
                            }
                        ))
                    );

                    innerListTxt = innerListTxt.replace(/>/g, '<')
                    return innerListTxt
                }
            ))
        );

        // add ['s for our tags back in
        text = text.replace(/</g, '[')
        return text
    }





        

    function parseBBCode(bbcode, errorQueue){
		errorQueue = errorQueue || []
		let remainderCode = bbcode
		let root = new TreeNode()
		let currentNode = root
		
		while(remainderCode){
			;[currentNode, remainderCode] = currentNode.findNextNode(remainderCode)				//The node should save whatever BBCode it needs and returns whatever hasn't been processed, along with the next node responsible for it
		}
		const resultingCode = root.parseTree()
		for(let error of TreeNode.getErrorQueue()){
			errorQueue.push(error)
		}
		TreeNode.clearErrorQueue()
		return(resultingCode)
		
    }

	me.parseBBCode = parseBBCode		//Exposing this function for editor. We could probably make it work without it but eh. Minimal changes from original desig (yeah, right).
    

    // -----------------------------------------------------------------------------
    // public functions
    // -----------------------------------------------------------------------------

    // API, Expose all available tags
    me.tags = function() {
        return tags
    }

    // API
	
	function preParsePost(postContents){
		let tagFinder = new RegExp('\\[(' + newTagList.join('|') +')\\s*(=\\s*([a-zA-Z0-9 /]+?))?]', 'mig') //MAKE SURE CASE INSENSITIVE
		let endTagFinder = new RegExp('\\[/(' + newTagList.join('|') +')]', 'mig') //MAKE SURE CASE INSENSITIVE
		let tagReplacements = [...postContents.matchAll(tagFinder)]
		let endTagReplacements = [...postContents.matchAll(endTagFinder)]
		for(let replacer of tagReplacements){
			const tag = replacer[1]																		//First match is font
			let tagData = replacer[3] || ''																//Empty string if undefined
			tagData = tagData.replaceAll(' ', '%20').replaceAll('/', '%2F')								//Replace spaces and slashes with URL encodings
			const originalMatch = replacer[0]
			postContents = postContents.replace(originalMatch, '[url=https://roleplayerguild.com/newtags/start?tag=' + tag + '&data=' + tagData + '][/url]')		//These don't need to be replaceAll because we're iterating through all replacements
		}
		for(let replacer of endTagReplacements){
			const tag = replacer[1]																		//First match is font
			let tagData = replacer[3] || ''																//Empty string if undefined
			tagData = tagData.replaceAll(' ', '%20').replaceAll('/', '%2F')								//Replace spaces and slashes with URL encodings
			const originalMatch = replacer[0]
			postContents = postContents.replace(originalMatch, '[url=https://roleplayerguild.com/newtags/end?tag=' + tag + '&data=' + tagData + '][/url]')
		}
		return postContents
    }
	
	me.preParser = preParsePost														//Export the ability to parse these as normal tags
	
	
	
	
	me.process = function(config) {
        var ret = { html: '', error: false },
            errQueue = []

		config.text = processCustomCode(config.text)
        config.text = escapeHtml(config.text) //Escape dangerous characters

        config.text = fixStarTag(config.text) // add in closing tags for the [*] tag

        ret.html = parseBBCode(config.text, errQueue)
		//ret.html = parseBBCode(ret.html, errQueue)

        // Wrap >greentext with styling
        ret.html = replaceGreenText(ret.html)

        if (config.addInLineBreaks) {
            ret.html =    
                '<div style="white-space:pre-wrap;">' + ret.html + '</div>'
        }

        // Replace smilie codes with <img>s
        ret.html = replaceSmilies(ret.html)

        // Replace [@Mentions] with a link
        ret.html = replaceMentions(ret.html)

        ret.html = ret.html.replace(/\t/g, '&#9;')
        ret.html = ret.html.replace(/\r/g, '')
        ret.html = ret.html.replace(/\n{2,}/g, '\n\n')
        ret.html = ret.html.replace(/\n/g, '<br>')

        errQueue = makeUnique(errQueue)
        ret.error = errQueue.length !== 0
        ret.errorQueue = errQueue

        return ret
    }
function getArgumentsObject (argumentsList){
	let args = {}
	for(const argument of argumentsList){
		let argPair = argument.split("=")
		let key = argPair[0].toLowerCase()
		let value = argPair[1] || ''
		args[key] = value																//Save the argument in the dictionary
	}
	return args
}
	

	
	//TODO: Need to convert between tags
	function processAllPosts() {																//We call this when initializing our new BBCode object in order to parse all other post content with new BBCode
		let postBodies = document.querySelectorAll('.post-content')
		for(let post of postBodies){
			post = post.querySelector('div[style="white-space:pre-wrap;"]') || post				//Get rid of white-space style div because we don't process it while previewing the page (only matters if bbcode is busted)
			post.innerHTML = parseBBCode(tagMarkersToCustom(post.getInnerHTML()))				//We really need to translate back to a language the parser can understand
		}
		bioBody = document.querySelectorAll('.user-bio')
		for(let bio of bioBody){
			bio = bio.querySelector('div[style="white-space:pre-wrap;"]') || bio
			bio.innerHTML = parseBBCode(tagMarkersToCustom(bio.getInnerHTML()))
		}
	}
	me.processAllPosts = processAllPosts
    return me
}

var autolinkerOpts = {
    stripPrefix: true,
    truncate: 40,
    email: false,
    phone: false,
    twitter: false,
    hashtag: false,
    newWindow: false,
    // keep synced with [url] logic
    replaceFn: function(match) {
        //var tag = autolinker.getTagBuilder().build(match);
        var tag = match.buildTag()
        // dumb way to see if user is linking internally or externally
        if (!/^((https?:\/\/)?roleplayerguild.com)/i.test(match.getAnchorHref())) {
            tag.setAttr('rel', 'nofollow noopener').setAttr('target', '_blank')
        }
        return tag
    },
}

// Allow bbcode_editor.js to access it
window.autolinkerOpts = autolinkerOpts


// We're on the client so export to window
window.bbcode = function(markup) {
	var result = XBBCODE.process({ text: markup, addInLineBreaks: true })
	var html = Autolinker.link(result.html, autolinkerOpts)
	return html
}

function tagMarkersToCustom(postText){
	return processCustomCode(convertTagMarkers(postText))
}

function convertTagMarkers(postText){
	const tagLinkRegex = /<a href="(https:\/\/roleplayerguild\.com\/newtags\/(start|end)\?[a-zA-Z0-9&;=\-%]+?)"><\/a>/mg
	const tagLinks = [...postText.matchAll(tagLinkRegex)]
	for(const match of tagLinks){
		const fullMatch = match[0]
		const urlData = match[1]															//Tag is everything but & up until & or end of string
		postText = postText.replace(fullMatch, '[url=' + urlData + '][/url]')
	}
	return postText
}

//Need to add these functions to this file because guildhall.js is isolated from main page execution context, and this one needs to act in the same context.
function processCustomCode(postText){
	const opentagRegex = /\[url=https:\/\/roleplayerguild\.com\/newtags\/start\?([a-zA-Z0-9&;=\-%]+?)\]\[\/url\]/mg
	const closetagRegex = /\[url=https:\/\/roleplayerguild\.com\/newtags\/end\?([a-zA-Z0-9&;=\-%]+?)\]\[\/url\]/mg
	
	const openTags = [...postText.matchAll(opentagRegex)]
	for(const tagMatch of openTags){
		const fullMatch = tagMatch[0]
		const metadata = tagMatch[1]
		const tag = metadata.match(/tag=([^&]*).*$/m)[1]																	//Tag is everything but & up until & or end of string
		let tagData = metadata.match(/data=([^&]*).*$/m) || ''																//Tag is everything but & up until & or end of string
		tagData = tagData[1].replaceAll('%20', ' ').replaceAll('%2F', '/')													//Reverse auto-encoding
		const dataString = tagData ? '=' + tagData : ''																		//We only need =data if the tag has a data parameter
		postText = postText.replace(fullMatch, '[' + tag + dataString + ']')												//Only replace one because we're going through all of them anyway
	}
	const closeTags = [...postText.matchAll(closetagRegex)]
	for(const tagMatch of closeTags){
		const fullMatch = tagMatch[0]
		const metadata = tagMatch[1]
		const tag = metadata.match(/tag=([^&]*).*$/m)[1] || ''																//Tag is everything but & up until & or end of string
		postText = postText.replace(fullMatch, '[/' + tag + ']')															//We don't need metadata because (for now) closing tags can't contain any data. Maybe this will change someday.
	}
	return postText
}


function newEditButton(){
	$('.post-edit-btn').unbind('click')
  $('.post-edit-btn').click(function(e) {
	e.preventDefault();
	$post_edit_btn = $(this);
	$post_edit_btn.addClass('disabled');
	var post_id = $(this).attr('post-id');
	var $post_body = $('#post-' + post_id + ' .post-content');
	var prev_body = $post_body.html();
	var $spinner = $('<span><img src="/img/spinner.gif" alt="Loading..." title="Loading..."> Loading edit form...</span>');

	// Replace post body with a spinner to indicate we're doing something
	$post_body.html($spinner);

	$cancel_btn = $('<button style="margin-left: 5px;" class="btn btn-default post-edit-cancel-btn">Cancel</button>');
	
	const postEditURL = window.location.pathname.startsWith('/convos/') ? '/pms/' + post_id : '/posts/' + post_id				//Different retrieval URLs for PMs vs posts
	
	$.ajax({
	  url: postEditURL + '/raw',
	  dataType: 'html',
	  cache: false,
	  // This is going to be post.markup || post.text
	  success: function(post_text) {
		var $post_editor = $('<textarea class="post-editor form-control"></textarea>');
		$spinner.remove();

		// Warn about Markdown->BBCode conversion on Markdown posts.
		// A post is a Markdown post if its post-body is wrapped with
		// .post-body instead of .post-body-html
		if ($('#post-' + post_id + ' .post-body')[0]) {
		  $post_body.append(
			'<p style="color: salmon">'+
			'This post uses the old formatting system (Markdown) before we had BBCode. If you click "Save", then the forum will assume that you\'ve converted this post to BBCode. If you don\'t want that to happen, then click "Cancel".'+
			'</p><p style="color: salmon">'+
			'For example, <code>[Click Me](http://example.com)</code> (Old system) is now <code>[url=http://example.com]Click Me[/url]</code> (BBCode)'+
			'</p>'
		  );
		}

		$post_body.append($post_editor);

		var $M = $post_editor.bbcode({
		  savable: true,
		  charLimit: 150000,
		  onSave: function(e) {
			//
			$success_btn = $post_body.find('.btn-success');
			$success_btn.html('Saving...');
			$success_btn.attr('disabled', true);
			$post_body.find('.btn').attr('disabled', true);

			var text_to_save = e.getContent();
			var reason = e.$editor.find('input[name="reason"]').val()
			$.ajax({
			  url: '/api' + postEditURL,											//e.g. /api/pms/postID, /api/posts/postID
			  dataType: 'json',
			  type: 'POST',
			  headers: { 'X-HTTP-Method-Override': 'PUT' },
			  data: {
				markup: XBBCODE.preParser(text_to_save),							//Convert to original BBCode format
				reason: reason
			  },
			  success: function(updated_post) {
				const innerReg = /^<div style="white-space:pre-wrap;">(.*)<\/div>$/
				const matches = updated_post.html.match(innerReg)
				if(matches)															//Get rid of white-space div so it matches our preview
				{
					updated_post.html = matches[1]
				}
				$post_body.html(XBBCODE.parseBBCode(tagMarkersToCustom(updated_post.html)));			//Display to user as new BBCode format
				$post_edit_btn.removeClass('disabled');
				// Set the post's .edited-marker to ' edited'
				var $edited_marker = $('#post-' + post_id + ' .edited-marker')
				$edited_marker.html(' edited');
			  }
			})
		  }
		});

		// Gotta set the text before the .markdown() call or else
		// .markdown() escapes html entities.
		$post_body.find('textarea').val(processCustomCode(post_text))				//Convert the new tags to a format the parser can understand

		// Scroll to editor over 500ms so user can re-orient themselves
		$('body').animate({
			scrollTop: $post_body.offset().top
		}, 500);

		$cancel_btn.insertAfter(
		  $('#post-' + post_id + ' .md-footer button[data-handler="cmdSave"]')
		);

		$($cancel_btn).click(function() {
		  $post_body.html(prev_body);
		  $post_edit_btn.removeClass('disabled');
		});

		// Add reason field if it's zeroth post form
		if ($post_edit_btn.closest('.post').hasClass('zeroth-post')) {
		  $M.$editor.find('.md-footer').prepend(
			'<div class="form-group">'+
			'<input type="text" class="form-control" name="reason" placeholder="Reason for edit (Optional)" maxlength="300">'+
			'</div>'
		  )
		}
	  }
	});

	return false;
  });
}

function newBioButton(){
	$('#edit-bio').unbind('click')
    $('#edit-bio').on('click', function() {
      var userId = $(this).attr('data-user-id');
      var $cancelBtn = $('<button style="margin-left: 5px;" class="btn btn-default post-edit-cancel-btn">Cancel</button>');
      var $editor = $('<textarea class="editor form-control">'+processCustomCode($('#bio-markup').text())+'</textarea>');										//Add custom processing before supplying to bio editor
      $('.user-bio').html(
        "<p>Write whatever you want in your bio. Everyone can see it, even people not logged in.</p>"+
        "<p>Ideas: Introduce yourself, keep a list of roleplays you're involved in, describe what kind of roleplays/partners you're looking for, provide off-site contact info, share some hilarious jokes, share art, share dank memes, etc.</p>"+
        "<p>Must be no more than 100000 chars</p>"
      );
      $('.user-bio').append($editor);
      $editor.bbcode({
        charLimit: 100000,
        savable: true,
        onSave: function(e) {
          var newBioMarkup = e.getContent();
          $.ajax({
            url: '/api/users/' + userId + '/bio',
            dataType: 'json',
            type: 'POST',
            headers: { 'X-HTTP-Method-Override': 'PUT' },
            data: { markup: XBBCODE.preParser(newBioMarkup) },																									//Process new tags before sending to server
            success: function(updatedUser) {
			  const innerReg = /^<div style="white-space:pre-wrap;">(.*)<\/div>$/
			  const matches = updatedUser.bio_html.match(innerReg)
			  if(matches)															//Get rid of white-space div so it matches our preview
			  {
				updatedUser.bio_html = matches[1]
			  }
              $('.user-bio').html(XBBCODE.parseBBCode(tagMarkersToCustom(updatedUser.bio_html)) || 'User has no bio, yet');														//Display new bio when saved
              $('#bio-markup').text(updatedUser.bio_markup);
              $('#bio-html').text(updatedUser.bio_html);
            }
          });
        }
      });

      $cancelBtn.insertAfter(
        $('.user-bio .md-footer button[data-handler="cmdSave"]')
      );

      $cancelBtn.on('click', function() {
        $('.user-bio').html($('#bio-html').text() || 'User has no bio, yet');
      });
    });
  	
}

function newPostButton(){
	let postForm = document.querySelector('[id="new-post"]') || document.querySelector('[id="reply-form"]')
	if(!postForm){
		return
	}
	postForm.onsubmit = function(){
		let postText = postForm.querySelector('#markup-input')
		postText.value = XBBCODE.preParser(postText.value)
	}
	
}

/*
   The following comment block is the original license, though
   this file has been significantly modified/hacked from what
   it originally was.
*/

/*
  Copyright (C) 2011 Patrick Gillespie, http://patorjk.com/

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/
