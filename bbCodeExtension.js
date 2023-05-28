/*
   We want to keep this file as close to parity with https://github.com/LegendBegins/guild/blob/master/server/bbcode.js as possible. But we will be extending the functionality.
*/

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

// String -> Maybe String
function extractYoutubeId(url) {
    var re = /^.*(?:youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([A-Za-z0-9_\-]{11}).*/
    var match = url.match(re)
    return match && match[1]
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
    var colorSpec = {
        colorErrorStack: [],
        //Variable local to the object that determines whether the colors are valid
        //It's a stack so it can keep track of the corresponding closing tags in the case of an error
        openTag: function(params, content, tagStack, errorQueue) {
            // Ensure they gave us a colorCode
            if (!params) {
                errorQueue.push(
                    'You have a COLOR tag that does not specify a color'
                )
                this.colorErrorStack.push(true)
                return '&#91;color&#93;'
            }

            var colorCode = params.toLowerCase()

            // Ensure colorCode is actually a color
            // TODO: Look up why library sets lastIndex to 0. Roll with it for now.
            colorNamePattern.lastIndex = 0
            colorCodePattern.lastIndex = 0
            if (
                !colorNamePattern.test(colorCode) &&
                !colorCodePattern.test(colorCode)
            ) {
                errorQueue.push(
                    'You have a COLOR tag with an invalid color: ' +
                        '[color=' +
                        params +
                        ']'
                )
                this.colorErrorStack.push(true)
                return '&#91;color=' + params + '&#93;'
            }

            // If colorCode is a hex value, prefix it with # if it's missing
            colorCodePattern.lastIndex = 0
            if (
                colorCodePattern.test(colorCode) &&
                colorCode.substr(0, 1) !== '#'
            ) {
                colorCode = '#' + colorCode
            }
            this.colorErrorStack.push(false)
            //False indicating that this color tag is not invalid
            return '<font color="' + colorCode + '">'
        },
        closeTag: function(params, content, tagStack, errorQueue) {
            return this.colorErrorStack.pop() ? '&#91;/color&#93;' : '</font>'
            //Pop is always a safe operation because if there's an imbalance in tags, it'll be handled in parseBBCode
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

    var makeUnique = function(a) {
        var seen = {};
        return a.filter(function(item) {
            return seen.hasOwnProperty(item) ? false : (seen[item] = true);
        });
    }
    singleTags = {
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
		progress: {
			 openTag: function(params, content) {
                return ('<progress max="100" value="' + params + '"></progress>')
            }
		},
		legend: {
            openTag: function(params, content) {
				const innerLink = params ? params : 'LegendBegins'
                return ('<a target="_blank" rel="nofollow noopener" href="https://YouTube.com/LegendBegins">' + innerLink + '</a>')
                //Contributor Easter Egg. Feel free to remove
            },
        }
    }
    function isParentCorrect(restrictParentsTo, tagStack){
        let parentTag
        if(tagStack.length > 1){
            //If more than just us on the stack
            parentTag = tagStack[tagStack.length - 2].tag
            //Grab .tag because the tag stack is strucured {tag, tagData}
        }
        for(let i = 0; i < restrictParentsTo.length; i++){
            //Enumerate through acceptable parent list. Faster than for-in
            if(restrictParentsTo[i] == parentTag){
                return true
                //If we find the parent
            }
        }
        return false
        //If we didn't find the tag
    }
    
    stopTags = {												//We don't allow stoptags, sadly. Not yet, maybe not ever. I guess we could try requesting raw BBCode for any posts that contain a custom stoptag, but that's not a problem for today.
        youtube: {
            openTag: function(params, content, tagStack, errorQueue) {
                var youtubeId = extractYoutubeId(content)
                if (!youtubeId){
                    errorQueue.push('The video URL appears to be invalid')
                    return '&#91;youtube&#93;' + content +' &#91;/youtube]'
                    //TO DO: Fix AutoLinker incompatibilities. For now, there's a space before [/youtube] to fix the broken hotlinking
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
        code: {
            trimContents: true,
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
            },
        },
        img: {
            openTag: function(params, content) {
                var myUrl = content.trim()

                urlPattern.lastIndex = 0
                if (!urlPattern.test(myUrl)) {
                    myUrl = ''
                }

                return '<img src="' + escapeHtml(myUrl) + '" />'
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
		url: {
            trimContents: true,
            urlErrorStack: [],
            openTag: function(params, content, tagStack, errorQueue) {
                var myUrl
                if (!params) {
                    myUrl = content.trim().replace(/<.*?>/g, '')
                } else {
                    myUrl = params
                        .trim()
                }
                if (
                    myUrl.indexOf('http://') !== 0 &&
                    myUrl.indexOf('https://') !== 0 &&
                    myUrl.indexOf('ftp://') !== 0
                ) {
                    // they don't have a valid protocol at the start, so add one [#63]
                    myUrl = 'http://' + myUrl
                }

                urlPattern.lastIndex = 0
                if (!urlPattern.test(myUrl)) {
                    this.urlErrorStack.push(true)
                    errorQueue.push('One of your [url] tags has an invalid url')
                    if (params) return '&#91;url=' + myUrl + '&#93;'
                    else return '&#91;url&#93;'
                }

                // dumb way to see if user is linking internally or externally
                // keep synced with Autolinker#replaceFn definedin this file
                this.urlErrorStack.push(false)
                //If we reach this point, it is a valid URL
                if (/^((https?:\/\/)?roleplayerguild.com)/i.test(myUrl)) {
                    // internal link
                    return '<a href="' + myUrl + '">' + content
                } else {
                    // external link
                    return (
                        '<a target="_blank" rel="nofollow noopener" href="' +
                        myUrl +
                        '">' + content
                    )
                }
            },
            closeTag: function(params, content) {
                return this.urlErrorStack.pop() ? '&#91;/url&#93;' : '</a>'
            },
        },
    }
    tags = {
        //
        // Custom BBCode for the Guild
        //
        hider: {
            trimContents: true,
            openTag: function(params, content) {
                var title = params ? escapeHtml(params) : 'Hider'
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
                    '<div class="hider-body" style="display: none">'
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
                    '">'
                )
            },
            closeTag: function(params, content) {
                return '</abbr>'
            },
        },
        mark: {
            openTag: function(params, content) {
                return '<span class="bb-mark">'
            },
            closeTag: function(params, content) {
                return '</span>'
            },
        },
        indent: {
            trimContents: true,
            openTag: function(params, content) {
                return '<div class="bb-indent">'
            },
            closeTag: function(params, content) {
                return '</div>'
            },
        },
        h1: {
            trimContents: true,
            openTag: function(params, content) {
                return '<div class="bb-h1">'
            },
            closeTag: function(params, content) {
                return '</div>'
            },
        },
        h2: {
            trimContents: true,
            openTag: function(params, content) {
                return '<div class="bb-h2">'
            },
            closeTag: function(params, content) {
                return '</div>'
            },
        },
        h3: {
            trimContents: true,
            openTag: function(params, content) {
                return '<div class="bb-h3">'
            },
            closeTag: function(params, content) {
                return '</div>'
            },
        },

        ////
        //// Tabs are temporarily disabled until fixed
        ////

        // "tabs": {
        //   restrictChildrenTo: ["tab"],
        //   openTag: function(params, content) {
        //     var html = '<div role="tabpanel" style="white-space: normal">';
        //     html = html + '<ul class="nav nav-tabs" role="tablist">';

        //     // This is what we're gonna loop through
        //     // We just build it differently on server vs the client
        //     var $coll;

        //     if (typeof window === 'undefined') {
        //       // In Node, $ won't exist
        //       var $ = cheerio.load(content);
        //       $coll = $('div[data-title]');
        //     } else {
        //       // In JS, $ will exist
        //       $coll = $('<div></div>').append(content).find('div[data-title]');
        //     }

        //     // var $ = cheerio.load(content);
        //     // $('div[data-title]').each(function(idx) {
        //     //$('<div></div>').append(content).find('div[data-title]').each(function(idx) {
        //     $coll.each(function(idx) {
        //       var title = $(this).attr('data-title');
        //       var id = $(this).attr('id');
        //       if (idx===0) {
        //         $(this).addClass('active');
        //       }
        //       html = html + '<li'+ (idx===0 ? ' class="active"' : '') +'><a href="#'+id+'" data-toggle="tab">' + title + '</a></li>';
        //     });
        //     html = html + '</ul>';
        //     html = html + '<div class="tab-content tabbed-content">';
        //     return html;
        //   },
        //   closeTag: function(params, content) {
        //     tabIdx = 0;
        //     return '</div></div>';
        //   }
        // },

        // "tab": {
        //   restrictParentsTo: ['tabs'],
        //   openTag: function(params, content) {
        //     var title = params ? params : 'Tab';
        //     var uuid = generateUuid();
        //     return '<div role="tabpanel" style="white-space: pre-line" class="tab-pane' + (tabIdx++===0 ? ' active' : '') +'" id="'+uuid+'" data-title="' + title + '">';
        //   },
        //   closeTag: function(params, content) {
        //     return '</div>';
        //   }
        // },
        //
        // BBCode that shipped with XBBCODE library
        //

        b: {
            openTag: function(params, content) {
                return '<span class="bb-b">'
            },
            closeTag: function(params, content) {
                return '</span>'
            },
        },
        /*
      This tag does nothing and is here mostly to be used as a classification for
      the bbcode input when evaluating parent-child tag relationships
    */
        bbcode: {
            //Only included for backward compatibility. Can safely be removed
            openTag: function(params, content) {
                return ''
            },
            closeTag: function(params, content) {
                return ''
            },
        },
        center: centerSpec,
        centre: centerSpec,
        color: colorSpec,
        colour: colorSpec,
        // "email": {
        //   openTag: function(params,content) {

        //     var myEmail;

        //     if (!params) {
        //       myEmail = content.replace(/<.*?>/g,"");
        //     } else {
        //       myEmail = params.substr(1);
        //     }

        //     emailPattern.lastIndex = 0;
        //     if ( !emailPattern.test( myEmail ) ) {
        //       return '<a>';
        //     }

        //     return '<a href="mailto:' + myEmail + '">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</a>';
        //   }
        // },
        // "face": {
        //   openTag: function(params,content) {

        //     var faceCode = params.substr(1) || "inherit";
        //     fontFacePattern.lastIndex = 0;
        //     if ( !fontFacePattern.test( faceCode ) ) {
        //       faceCode = "inherit";
        //     }
        //     return '<span style="font-family:' + faceCode + '">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</span>';
        //   }
        // },
         font: {
           openTag: function(params,content) {

             var faceCode = params || "inherit";
             fontFacePattern.lastIndex = 0;
             if ( !fontFacePattern.test( faceCode ) ) {
               faceCode = "inherit";
             }
             return '<span style="font-family:' + faceCode + '">';
           },
           closeTag: function(params,content) {
             return '</span>';
           }
         },
        i: {
            openTag: function(params, content) {
                return '<span class="bb-i">'
            },
            closeTag: function(params, content) {
                return '</span>'
            },
        },
        justify: {
            trimContents: true,
            openTag: function(params, content) {
                return '<div class="bb-justify">'
            },
            closeTag: function(params, content) {
                return '</div>'
            },
        },
        // "large": {
        //   openTag: function(params,content) {
        //         var params = params || '';
        //         var colorCode = params.substr(1) || "inherit";
        //     colorNamePattern.lastIndex = 0;
        //     colorCodePattern.lastIndex = 0;
        //     if ( !colorNamePattern.test( colorCode ) ) {
        //       if ( !colorCodePattern.test( colorCode ) ) {
        //         colorCode = "inherit";
        //       } else {
        //         if (colorCode.substr(0,1) !== "#") {
        //           colorCode = "#" + colorCode;
        //         }
        //       }
        //     }
        //     return '<span class="xbbcode-size-36" style="color:' + colorCode + '">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</span>';
        //   }
        // },
         "left": {
           openTag: function(params,content) {
             return '<div class="bb-left">';
           },
           closeTag: function(params,content) {
             return '</div>';
           }
         },
        // "li": {
        //   openTag: function(params,content) {
        //     return '<li style="white-space: pre-line;">';
        //   },
        //   closeTag: function(params,content) {
        //     return "</li>";
        //   },
        //   restrictParentsTo: ["list","ul","ol"]
        // },
        list: {
            openTag: function(params, content) {
                return '<ul class="bb-list" style="white-space: normal;">'
            },
            closeTag: function(params, content) {
                return '</ul>'
            },
        },
        // "ol": {
        //   openTag: function(params,content) {
        //     return '<ol style="white-space: normal">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</ol>';
        //   },
        //   restrictChildrenTo: ["*", "li"]
        // },
        // "php": {
        //   openTag: function(params,content) {
        //     return '<span class="xbbcode-code">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</span>';
        //   },
        //   noParse: true
        // },
        quote: {
            trimContents: true,
            openTag: function(params, content) {
                return '<blockquote class="bb-quote">'
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
                return '<div class="bb-right">'
            },
            closeTag: function(params, content) {
                return '</div>'
            },
        },
        s: {
            openTag: function(params, content) {
                return '<span class="bb-s">'
            },
            closeTag: function(params, content) {
                return '</span>'
            },
        },
        // "size": {
        //   openTag: function(params,content) {

        //     var mySize = parseInt(params.substr(1),10) || 0;
        //     if (mySize < 4 || mySize > 40) {
        //       mySize = 14;
        //     }

        //     return '<span class="xbbcode-size-' + mySize + '">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</span>';
        //   }
        // },
        // "small": {
        //   openTag: function(params,content) {
        //         var params = params || '';
        //         var colorCode = params.substr(1) || "inherit";
        //     colorNamePattern.lastIndex = 0;
        //     colorCodePattern.lastIndex = 0;
        //     if ( !colorNamePattern.test( colorCode ) ) {
        //       if ( !colorCodePattern.test( colorCode ) ) {
        //         colorCode = "inherit";
        //       } else {
        //         if (colorCode.substr(0,1) !== "#") {
        //           colorCode = "#" + colorCode;
        //         }
        //       }
        //     }

        //     return '<span class="xbbcode-size-10" style="color:' + colorCode + '">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</span>';
        //   }
        // },
        sub: {
            openTag: function(params, content) {
                return '<sub>'
            },
            closeTag: function(params, content) {
                return '</sub>'
            },
        },
        sup: {
            openTag: function(params, content) {
                return '<sup>'
            },
            closeTag: function(params, content) {
                return '</sup>'
            },
        },
        table: {
            tableStack: [],
            //Increment once for every nested table as to not break div tags
            openTag: function(params, content, tagStack, errorQueue) {
                if(this.tableStack.length > 0){
                    //If this is a nested table
                    let foundParent = isParentCorrect(this.restrictParentsTo, tagStack)
                    if(!foundParent){
                        //If the parent isn't a cell, don't try to nest the table (Note: overriding this CAN break HTML)
                        errorQueue.push('The only acceptable parents of a nested table include: ' + this.restrictParentsTo)
                        this.tableStack.push(false)
                        //We didn't open a table with this one
                        return ''
                    }
                }
                this.tableStack.push(false)
                if (params === 'bordered')
                    return '<div class="table-responsive"><table class="bb-table table table-bordered">'
                return '<div class="table-responsive"><table class="bb-table table">'
            },
            closeTag: function(params, content) {
                if(!this.tableStack.pop()){
                    //Pop will never be called on an empty stack because closeTag is only called when an opening tag was seen first
                    return '</table></div>'
                }
                return ''
            },
            restrictParentsTo: ['cell'],
        },
        // "tbody": {
        //   openTag: function(params,content) {
        //     return '<tbody>';
        //   },
        //   closeTag: function(params,content) {
        //     return '</tbody>';
        //   },
        //   restrictChildrenTo: ["tr"],
        //   restrictParentsTo: ["table"]
        // },
        // "tfoot": {
        //   openTag: function(params,content) {
        //     return '<tfoot class="bb-tfoot">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</tfoot>';
        //   },
        //   restrictChildrenTo: ["tr"],
        //   restrictParentsTo: ["table"]
        // },
        // "thead": {
        //   openTag: function(params,content) {
        //     return '<thead class="bb-thead">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</thead>';
        //   },
        //   restrictChildrenTo: ["tr"],
        //   restrictParentsTo: ["table"]
        // },
        cell: {
            openTag: function(params, content, tagStack, errorQueue) {
                let foundParent = isParentCorrect(this.restrictParentsTo, tagStack)
                if(!foundParent){
                    errorQueue.push('The only acceptable parents of the tag \'cell\' include: ' + this.restrictParentsTo)
                    return ''
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
                
                //NOTE: If you want to automate th and thead, you need a stack to account for nested tables.
                //However, I don't really think they should be auto-th because users should be able to stylize tables how they want
                //if (isFirstTableRow) return '<th class="bb-th">'
                return '<td class="' + classNames.join(' ') + '">'
            },
            closeTag: function(params, content) {
               // if (isFirstTableRow) return '</th>'
                return '</td>'
            },
            restrictParentsTo: ['row'],
        },
        // "th": {
        //   openTag: function(params,content) {
        //     return '<th class="bb-th">';
        //   },
        //   closeTag: function(params,content) {
        //     return '</th>';
        //   },
        //   restrictParentsTo: ["tr"]
        // },
        row: {
            openTag: function(params, content, tagStack, errorQueue) {                
                let foundParent = isParentCorrect(this.restrictParentsTo, tagStack)
                if(!foundParent){
                    errorQueue.push('The only acceptable parents of the tag \'row\' include: ' + this.restrictParentsTo)
                    return '<tr>'
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
                return '<tr class="' + classNames.join(' ') + '">'
            },
            closeTag: function(params, content) {
                /*if (isFirstTableRow) html = '</tr></thead>'
                else html = '</tr>'
                isFirstTableRow = false*/
                return '</tr>'
            },
            restrictParentsTo: ['table']
        },
        u: {
            openTag: function(params, content) {
                return '<span class="bb-u">'
            },
            closeTag: function(params, content) {
                return '</span>'
            },
        },
        // "ul": {
        //   openTag: function(params,content) {
        //     return '<ul>';
        //   },
        //   closeTag: function(params,content) {
        //     return '</ul>';
        //   },
        //   restrictChildrenTo: ["*", "li"]
        // },
        
        /*
      The [*] tag is special since the user does not define a closing [/*] tag when writing their bbcode.
      Instead this module parses the code and adds the closing [/*] tag in for them. None of the tags you
      add will act like this and this tag is an exception to the others.
    */
        '*': {    
            trimContents: true,
            openTag: function(params, content, tagStack, errorQueue) {
                let foundParent = isParentCorrect(this.restrictParentsTo, tagStack)
                if(!foundParent){
                    errorQueue.push('The only acceptable parents of the tag \'*\' include: ' + this.restrictParentsTo)
                    return '<tr>'
                }
                //Return li no matter what
                return '<li>'
            },
            closeTag: function(params, content) {
                return '</li>'
            },
            restrictParentsTo: ['list'] //, 'ul', 'ol'], These are now unused
        },
		marquee: {
			 openTag: function(params, content) {
                return '<marquee scrollamount=' + params + '>'
            },
            closeTag: function(params, content) {
                return '</marquee>'
            }
		},
		glow: {
			 openTag: function(params, content) {
                return '<span class="glow">'
            },
            closeTag: function(params, content) {
                return '</span>'
            }
		},
//		blockquote: {																									//Disabled until fixed
//			 openTag: function(params, content) {
//                return ('<blockquote cite="' + params + '">')
 //           },
 //           closeTag: function(params, content) {
//                return ('</blockquote><figcaption><cite>' + params + '</cite></figcaption>')
//            }
//		},
    }


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

    function regexEscapeList(replaceList) {
        //Makes every string in a list regex-safe
        for(let i in replaceList){
            replaceList[i] = replaceList[i].replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        }
        return replaceList
    }

    let stopList = regexEscapeList(Object.keys(stopTags))
    //Noparse tags
    let allTags = regexEscapeList(Object.keys(tags))
    //Grab all tag [pairs]
    //Regular tags with opening and closing versions
    let singleList = regexEscapeList(Object.keys(singleTags))
    //Tags that don't have a closing counterpart
    allTags = allTags.concat(stopList)
    allTags = allTags.concat(singleList)
    
    function onMisalignedTags(errorQueue = []){
        errorQueue.push('Some tags appear to be misaligned')
    }
    function processTag(tag, data = false, tagStack = [], errorQueue = []){
        if(tags[tag]){
            return tags[tag].openTag(data, null, tagStack, errorQueue)
        }
        else if(singleTags[tag]){
            return singleTags[tag].openTag(data, null, tagStack, errorQueue)
        }
        else{
            return ''
        }
    }
    function processCloseTag(tag, data = false, tagStack = [], errorQueue = []){
        if(tags[tag]){
            return tags[tag].closeTag(data, null, tagStack, errorQueue)
        }
        else{
            return ''
        }
    }
    function findClosingNoParse(tag, message, data = false, tagStack = [], errorQueue = []){
        let closeFinder = new RegExp('\\[\/(' + tag + ')(?=\\])', '')
        let endResult = closeFinder.exec(message)
        if(!endResult){
            //If the noparse tag isn't closed
            onMisalignedTags(errorQueue)
            return [message.length, message]
        }
        else{
            let innerContent = message.slice(0, endResult.index)
            //We have no idea how the tag wants to handle the inner data, so that's done in the tag functions themselves.
            return [endResult.index, stopTags[tag].openTag(data, innerContent, tagStack, errorQueue) + stopTags[tag].closeTag(data, innerContent, tagStack, errorQueue)]
            //Return the index of the end of the content and the HTML to be added
        }
    }

	let oldTags = allTags.filter( ( el ) => !newTagList.includes( el ) );													//We have to do this to avoid parsing the new tags with the original parser
    let tagRegex = new RegExp('\\[(' + oldTags.join('|') + ')(\\s*=.*?)?(?=\\])', 'i')
    let endTagRegex = new RegExp('\\[\\/(' + oldTags.join('|') + ')(?=\\])', 'i')
    //Positive lookbehind and lookahead to grab the tag we care about


    function getTagAndOptionalData(tagSearch){
        //Grab the two capturing groups (tag and the tag data) and return them. Return empty by default
        let mainTag = ''
        let innerData = ''
        if(tagSearch){
            mainTag = tagSearch[1].toLowerCase()
            //Grab main tag
            if(tagSearch[2]){
                innerData = tagSearch[2].slice(1,).trim()
                //Also grab inner data if it exists but remove = sign and trailing whitespace
            }
        }
        return [mainTag, innerData]
    }
        

    function parseBBCode(message, errorQueue){
        let contentEnd = 0
        //This value changes as we scan through the tag set
        let rebuiltString = ''
        let tagStack = []
        while(true){
            //Loop until we have traversed every tag in this level
            let result = tagRegex.exec(message.slice(contentEnd,))
            //We measure from contentEnd because we need to know where to search from when two tags are embedded on the same level
            let endResult = endTagRegex.exec(message.slice(contentEnd,))
            //We grab both the next start and end tags and see which comes first
            if(result && (!endResult || endResult.index > result.index)){
                //if our next tag is an open tag
                let [tag, tagData] = getTagAndOptionalData(result)
                tagStack.push({'tag':tag, 'data':tagData})
                //if there is no = in the tag, tagData will be null
                rebuiltString += message.slice(contentEnd, contentEnd + result.index)
                rebuiltString += processTag(tag, tagData, tagStack, errorQueue)
                //Add everything up to and including the tag to the rebuilt string. We have to remember that results is always going to be offset by contentEnd
                contentEnd += result.index + result[0].length + 1
                //End of content is where the results starts (open bracket) plus the length of the entire match (open bracket plus tag and/or data) plus the close bracket
                if(singleList.includes(tag)){
                    tagStack.pop()
                }
                else if(stopList.includes(tag)){
                    //if we encounter a noparse tag
                    let [endIndex, embeddedContent] = findClosingNoParse(tag, message.slice(contentEnd,), tagData, tagStack, errorQueue)
                    contentEnd += endIndex
                    rebuiltString += embeddedContent
                    //We have to add the index of the result as well
                }
            }
            else if(endResult){
                //If the next tag is a closing one
                let endTag = endResult[1].toLowerCase()
                let parserEnd = endResult.index + endResult[0].length + 1
                if(tagStack.length < 1){
                    //if this is an unpaired closing tag, treat it as text and keep going
                    rebuiltString += message.slice(contentEnd, contentEnd + parserEnd)
                    contentEnd += parserEnd
                    continue
                }
                else if(endTag != tagStack[tagStack.length - 1].tag){
                    //If our tags don't match
                    onMisalignedTags(errorQueue)
                }
                rebuiltString += message.slice(contentEnd, contentEnd + endResult.index)
                endData = tagStack.pop()
                //If the end tag is a mismatch, force them to align to not break the post
                rebuiltString += processCloseTag(endData.tag, endData.data, tagStack, errorQueue)
                contentEnd += parserEnd
            }
            else{
                //if we're out of tags
                if(tagStack.length > 0){
                    //if we don't have enough closing tags
                    onMisalignedTags(errorQueue)
                    while(tagStack.length > 0){
                        phantomData = tagStack.pop()
                        rebuiltString += processCloseTag(phantomData.tag, phantomData.data, tagStack, errorQueue)
                        //Finish adding missing ending tags
                    }
                }
                rebuiltString += message.slice(contentEnd,)
                break
            }
        }
        return rebuiltString
    }


    

    // -----------------------------------------------------------------------------
    // public functions
    // -----------------------------------------------------------------------------

    // API, Expose all available tags
    me.tags = function() {
        return tags
    }

    // API
	
	function preParsePost(postContents){
		//TODO: Known issue where close tags will always be parsed, even without corresponding opening tag. Fix when we launch new parser
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

		config.text = preParsePost(config.text)
        config.text = escapeHtml(config.text) //Escape dangerous characters

        config.text = fixStarTag(config.text) // add in closing tags for the [*] tag

        ret.html = parseBBCode(config.text, errQueue)
		ret.html = parseNewBBCode(ret.html, errQueue)

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
	
function findNewClosingNoParse(tag, message, data = false, tagStack = [], errorQueue = []){
		//Please never implement custom noparse tags. They will be parsed!
		let closeFinder = new RegExp('<a href="https:\\/\\/roleplayerguild\\.com\\/newtags\\/end\\?(([a-zA-Z0-9&;=\\-%]+?&amp;)*?(tag=' + tag + ')(&amp;[a-zA-Z0-9&;=\\-%]*?)*?)"><\\/a>', '')
        let endResult = closeFinder.exec(message)
        if(!endResult){
            //If the noparse tag isn't closed
            onMisalignedTags(errorQueue)
            return [message.length, message]
        }
        else{
            let innerContent = message.slice(0, endResult.index)
            //We have no idea how the tag wants to handle the inner data, so that's done in the tag functions themselves.
            return [endResult.index, stopTags[tag].openTag(data, innerContent, tagStack, errorQueue) + stopTags[tag].closeTag(data, innerContent, tagStack, errorQueue)]
            //Return the index of the end of the content and the HTML to be added
        }
    }	

 function getNewTagAndOptionalData(tagSearch){
        //Grab the tag and the tag data and return them. Return empty by default
        let argString = tagSearch[1]													//Grab the tag data capturing group
		argString = argString.replaceAll('%20', ' ')									//URL Decode spaces. May need to update if we want to support other characters later. But spaces are safe.
		argString = argString.replaceAll('%2F', '/')									//URL decode forward slash
		argString = argString.replaceAll('&amp;', '&')									//Replace ampersand with raw &. This function is called for both an encoded and non-encoded source
		let mainTag = ''
        let innerData = ''
        if(tagSearch){
			const argumentsList = argString.split('&')
            const args = getArgumentsObject(argumentsList)
			mainTag = args['tag'] || ''
			innerData = args['data'] || ''
        }
		mainTag = newTagList.includes(mainTag) ? mainTag : ''							//mainTag is either itself or set to null if the new tag isn't implemented.
        return [mainTag, innerData]
    }
        
	
	let newTagRegex = /<a href="https:\/\/roleplayerguild\.com\/newtags\/start\?([a-zA-Z0-9&;=\-%]+?)"><\/a>/m
    let newEndTagRegex = /<a href="https:\/\/roleplayerguild\.com\/newtags\/end\?([a-zA-Z0-9&;=\-%]+?)"><\/a>/m

    function parseNewBBCode(message, errorQueue){
        let contentEnd = 0
        //This value changes as we scan through the tag set
        let rebuiltString = ''
        let tagStack = []
        while(true){
            //Loop until we have traversed every tag in this level
            let result = newTagRegex.exec(message.slice(contentEnd,))
            //We measure from contentEnd because we need to know where to search from when two tags are embedded on the same level
            let endResult = newEndTagRegex.exec(message.slice(contentEnd,))
            //We grab both the next start and end tags and see which comes first
            if(result && (!endResult || endResult.index > result.index)){
                //if our next tag is an open tag
                let [tag, tagData] = getNewTagAndOptionalData(result)
                tagStack.push({'tag':tag, 'data':tagData})
                //if there is no = in the tag, tagData will be null
                rebuiltString += message.slice(contentEnd, contentEnd + result.index)
                rebuiltString += processTag(tag, tagData, tagStack, errorQueue)
                //Add everything up to and including the tag to the rebuilt string. We have to remember that results is always going to be offset by contentEnd
				
                contentEnd += result.index + result[0].length
                //End of content is where the results starts plus the length of the entire match (empty link to roleplayerguild)
                if(singleList.includes(tag)){
                    tagStack.pop()
                }
                else if(stopList.includes(tag)){
                    //if we encounter a noparse tag
                    let [endIndex, embeddedContent] = findNewClosingNoParse(tag, message.slice(contentEnd,), tagData, tagStack, errorQueue)
                    contentEnd += endIndex
                    rebuiltString += embeddedContent
                    //We have to add the index of the result as well
                }
            }
            else if(endResult){
                //If the next tag is a closing one
                let [endTag, endData] = getNewTagAndOptionalData(endResult)
                let parserEnd = endResult.index + endResult[0].length
                if(tagStack.length < 1){
                    //if this is an unpaired closing tag, treat it as text and keep going
                    rebuiltString += message.slice(contentEnd, contentEnd + parserEnd)
                    contentEnd += parserEnd
                    continue
                }
                else if(endTag != tagStack[tagStack.length - 1].tag){
                    //If our tags don't match
                    onMisalignedTags(errorQueue)
                }
                rebuiltString += message.slice(contentEnd, contentEnd + endResult.index)
                endData = tagStack.pop()
                //If the end tag is a mismatch, force them to align to not break the post
                rebuiltString += processCloseTag(endData.tag, endData.data, tagStack, errorQueue)
                contentEnd += parserEnd
            }
            else{
                //if we're out of tags
                if(tagStack.length > 0){
                    //if we don't have enough closing tags
                    onMisalignedTags(errorQueue)
                    while(tagStack.length > 0){
                        phantomData = tagStack.pop()
                        rebuiltString += processCloseTag(phantomData.tag, phantomData.data, tagStack, errorQueue)
                        //Finish adding missing ending tags
                    }
                }
                rebuiltString += message.slice(contentEnd,)
                break
            }
        }
        return rebuiltString
    }
	
	me.parseNewBBCode = parseNewBBCode
	
	function processAllPosts() {																						//We call this when initializing our new BBCode object in order to parse all other post content with new BBCode
		postBodies = document.querySelectorAll('.post-content')
		for(let post of postBodies){
			post.innerHTML = parseNewBBCode(post.getInnerHTML())
		}
		bioBody = document.querySelectorAll('.user-bio')
		for(let bio of bioBody){
			bio.innerHTML = parseNewBBCode(bio.getInnerHTML())
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



//Need to add these functions to this file because guildhall.js is isolated from main page execution context, and this one needs to act in the same context.
function processCustomCode(postText){
	opentagRegex = /\[url=https:\/\/roleplayerguild\.com\/newtags\/start\?([a-zA-Z0-9&;=\-%]+?)\]\[\/url\]/mg
	closetagRegex = /\[url=https:\/\/roleplayerguild\.com\/newtags\/end\?([a-zA-Z0-9&;=\-%]+?)\]\[\/url\]/mg
	
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
				$post_body.html(XBBCODE.parseNewBBCode(updated_post.html));			//Display to user as new BBCode format
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
      console.log('click');
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
          console.log('Saving2');
          var newBioMarkup = e.getContent();
          $.ajax({
            url: '/api/users/' + userId + '/bio',
            dataType: 'json',
            type: 'POST',
            headers: { 'X-HTTP-Method-Override': 'PUT' },
            data: { markup: XBBCODE.preParser(newBioMarkup) },																									//Process new tags before sending to server
            success: function(updatedUser) {
              $('.user-bio').html(XBBCODE.parseNewBBCode(updatedUser.bio_html) || 'User has no bio, yet');														//Display new bio when saved
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


//TODO: BBCode parsing tree

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
