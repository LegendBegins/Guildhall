
var errorStack = []														//Global stack for misplaced BBCode

//TODO: Add convert function for all new/modified tags to convert into Guild-safe tag and data structure
function regexEscapeList(replaceList) {
	//Makes every string in a list regex-safe
	for(let i in replaceList){
		replaceList[i] = replaceList[i].replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
	}
	return replaceList
}

var combinedTags = {}
Object.assign(combinedTags, singleTags)
Object.assign(combinedTags, stopTags)
Object.assign(combinedTags, tags)											//One big dictionary with everything

var tagList = Object.keys(combinedTags)


class TagHelper {			//Provides nice static functions for processing BBCode tags
	
	static newTagString = regexEscapeList(tagList).join('|')									//Save on computation
	
	
	static getNextTag(bbcode){
		const regexString = `((\\[(${TagHelper.newTagString})(\\s*=.*?)?\\])|(\\[\\/(${TagHelper.newTagString})\\]))`				//Interpolate the new tags into the regex. This finds both opening and closing tags
		const tagFinderRegex = new RegExp(regexString)
		let result = bbcode.match(tagFinderRegex)
		if(result){
			result = result[0]											//Grab full tag
		}
		return(result)
	}
	
	static getEndStopTag(tag, bbcode){
		return '[/' + tag + ']'												//For now, we don't support end tags with spaces or really anything other than the raw [/tag] for backwards-compatibility purposes
	}
	
	static getTagLabel(tag){
		//Please only pass the tag contents, including brackets []. Please don't pass anything that may not be a tag.
		const tagFilterRegex = /\[\/?([a-zA-Z]+)[\]=]/
		let result = tag.match(tagFilterRegex)
		if(result){
			result = result[1]											//Grab tag contents
		}
		return(result)
	}
	
	static getTagData(tagString){										//Only pass in things confirmed to conform to valid tags
		let dataIndex = tagString.indexOf('=')								//Find equal sign
		if(dataIndex === -1){
			return ''													//Should this return none instead? Probably not right?
		}
		return tagString.substring(dataIndex + 1, tagString.length - 1)		//Go after = and chop off the last char
	}
	
	static getDataBeforeTag(bbcode, tag){					
		let index = bbcode.indexOf(tag)
		if(index === -1){												//Tag wasn't found
			return null
		}
		return bbcode.substring(0, index)								//Everything before tag
	}
	
	static getDataAfterTag(bbcode, tag){								
		let index = bbcode.indexOf(tag)
		if(index === -1){												//Tag wasn't found
			return null
		}
		return bbcode.substring(index + tag.length)						//Ignore the tag itself
	}
	
	static isOpenTagString(tag){														//Please only pass known tags. This won't look for tags for you.
		return (tag.startsWith('[') && !tag.startsWith('[/'))			//Open bracket but doesn't start with a slash
	}
	static isCloseTagString(tag){												//Please only pass known tags. This won't look for tags for you.
		return (tag.startsWith('[/'))
	}
	
	static isStopTag(tag){
		return !!stopTags[tag]
	}
	
	
	static isSoloTag(tag){												//Only pass in the tag itself please
		return !!singleTags[tag]
	}
	
	static assignTagFunctions(node, tag){								//Please only pass in tags that are known to exist
		node.openTag = combinedTags[tag].openTag
		node.closeTag = combinedTags[tag].closeTag
	}
	
	static getTagHTML(node, tag, tagArgs, contents){					//Only pass in tags that are confirmed to exist
		if(!tag){														//Handling root nodes, hopefully
			return contents
		}
		if(node.openTag){												//If we recognize this tag
			let returnString = node.openTag(tagArgs, contents)
			if(node.closeTag){											//If we have a corresponding closing tag
				returnString += node.closeTag(tagArgs, contents)
			}
			return returnString
		}
		TreeNode.pushError('Somehow you\'ve embedded an unrecognized tag that we thought we recognized. Please contact LegendBegins with post contents.')
		return '[' + tag + ']' + contents + '[/' + tag + ']'			//We probably shouldn't ever reach this line
	}
}

class TreeNode {
	
	static errorQueue = []
	constructor(childContents = [], parentNode = null, tag = null, tagData = ''){
		this.childContents = childContents						//Can hold either strings or nodes
		this.parentNode = parentNode
		this.tag = tag
		this.tagData = tagData
		if(tag){
			TagHelper.assignTagFunctions(this, tag)				//If you don't pass in a tag and need openTag() or closeTag(), don't forget to set them later
		}
	}
	
	static getErrorQueue(){
		return TreeNode.errorQueue
	}
	static clearErrorQueue(){
		TreeNode.errorQueue = []
	}
	static pushError(errorName){
		return TreeNode.errorQueue.push(errorName)
	}
	pushNode(tag, tagData){
		this.childContents.push(new TreeNode([], this, tag, tagData))
	}
	
	getLastNode(){
		return this.childContents[this.childContents.length - 1]
	}
	
	getOpenSelfTag(){
		let openTag = '[' + this.tag
		if(this.tagData){
			this.openTag += '=' + this.tagData
		}
		openTag += ']'
		return openTag
	}
	getCloseSelfTag(){
		if(TagHelper.isSoloTag(this.tag)){											//If we're a solo tag, we don't have a close tag
			return ''
		}
		return '[/' + this.tag + ']'
	}
	
	tagMatchesSelf(tag){
		return(tag === this.tag)
	}
	
	getNodeData(innerContents){
		//We let tagHelper execute us so we can remain ignorant of the outer variables like combinedTags
		return TagHelper.getTagHTML(this, this.tag, this.tagData, innerContents)
	}
	
	handleNewOpenTag(tagString, remainderBBCode){								//You should probably break these three into separate functions if you do anything more here.
		let tagName = TagHelper.getTagLabel(tagString)
		let tagData = TagHelper.getTagData(tagString)
		if(TagHelper.isStopTag(tagName)){										//If we need to stop parsing until we get to the end (because contents may not be BBCode-compliant)
			const endTagString = TagHelper.getEndStopTag(tagName, remainderBBCode)	//Get complement stoptag
			this.pushNode(tagName, tagData)												//Add new blank child with its tag
			const skippedData = TagHelper.getDataBeforeTag(remainderBBCode, endTagString)
			if(skippedData === null){												//If they didn't put in an end tag, we consider it skipped and continue parsing
				this.badClosingTag()												//TODO: This is where we want to put other parsing conditions if we want to check several different mistakes users may have made and intelligently select the best way to parse
				//this.getLastNode().childContents.push(remainderBBCode)
				//remainderBBCode = ''
				this.childContents.push(tagString)									//Let's save the raw text of that tagString
				return([this, remainderBBCode])
			}
			else{
				this.getLastNode().childContents.push(skippedData)		//Add all of the skipped text to the child noparse
				remainderBBCode = TagHelper.getDataAfterTag(remainderBBCode, endTagString)	//Remove all noparse stuff from our bbcode
			}																			//We don't need to check again because that's complicit in getDataBeforeTag
			
			return([this, remainderBBCode])												//Continue where we left off after the noparse
		}
		else if(TagHelper.isSoloTag(tagName)){										//If we have a tag that adds content but doesn't obtain control over the next tag contents (at least I hope solo tags don't do that!)
			this.pushNode(tagName, tagData)												//Push the solo tag into our list of children
			return([this, remainderBBCode])										//But don't pass it control. We continue after it
		}
		else{
			this.pushNode(tagName, tagData)												//Repeating ourself in case we add additional tag categories later that don't want a child node with the tag name for some reason
			return([this.getLastNode(), remainderBBCode])
		}
	}
	
	handleNewCloseTag(tagString){
		let tagName = TagHelper.getTagLabel(tagString)
		let tagData = TagHelper.getTagData(tagString)
		if(!this.tagMatchesSelf(tagName)){									//If there's a mismatch
			this.badClosingTag()
			this.childContents.push(tagString)							//Don't process the raw text of the tag
			return this													//TODO: Decide where to return control to after a bad close tag. Maybe process tree in reverse and see if we can intelligently find a resolution? Ignore? Both and look for simplest answer? Merge?
		}																//Right now, it returns the current node, which should be fine since we basically ignore the closing tag
		else{
			return this.parentNode										//Return control to parent node, along with remaining text
		}
	}

	findNextNode(bbcode){
		//Either creates a new child node and passes control down, or terminates this node and passes control up
		let tagString = TagHelper.getNextTag(bbcode)
		if(!tagString){																	//We've reached the end of the line. Hopefully we're the root node!
			this.childContents.push(bbcode)
			if(this.parentNode){														//If we're not the root node (you can easily change this condition if you ever give roots parents)
				this.badClosingTag()
			}
			return [this, '']
		}
		this.childContents.push(TagHelper.getDataBeforeTag(bbcode, tagString))				//Can optimize with data returned in regex objects, like indices
		let remainderBBCode = TagHelper.getDataAfterTag(bbcode, tagString)		
		//tagString is [tag=stuff], tagName is just tag
		
		let nextNode = null
		if(TagHelper.isOpenTagString(tagString)){											//Semicolon prevents this from being interpreted as a list index
			;[nextNode, remainderBBCode] = this.handleNewOpenTag(tagString, remainderBBCode)		//Return control to parent node, along with remaining text
		}
		else if(TagHelper.isCloseTagString(tagString)){										//If we find a terminating tag
			nextNode = this.handleNewCloseTag(tagString)
		}
		return([nextNode, remainderBBCode])
	}
	
	badClosingTag(){
		TreeNode.pushError('Some tags appear to be misaligned')
		//TODO: Add a special internal-only tag to indicate that this is busted content, and then use that to mark the text (only for the preview page so users can see where things went wrong). Alternatively, add an error attribute to this object that we can check when rendering
	}
	
	parseTree(){													//TODO: Technically recursive. Consider changing to iterative.
		let fullString = ''
		for(const childNode of this.childContents){								//Iterate through children
			if(childNode instanceof TreeNode){									//If child is another node, have it build out its own tree structure
				fullString += childNode.parseTree()							//Add its branch string to ours and keep going
			}
			else{															//Otherwise it's a string
				fullString += childNode										//Add the string to our branch string and keep going
			}
		}
		return this.getNodeData(fullString)
	}
	
	
	parseRawTree(){													//TODO: Technically recursive. Consider changing to iterative.
		let fullString = ''
		let openTag = this.getOpenSelfTag()
		let closeTag = this.getCloseSelfTag()
		fullString += openTag
		// console.log(this.childContents)
		for(const childNode of this.childContents){								//Iterate through children
			// console.log(fullString)
			if(childNode instanceof TreeNode){									//If child is another node, have it build out its own tree structure
				fullString += childNode.parseRawTree()							//Add its branch string to ours and keep going
			}
			else{															//Otherwise it's a string
				fullString += childNode										//Add the string to our branch string and keep going
			}
		}
		fullString += closeTag
		return fullString
	}
	
	
}

//Ideas: There are a few common error cases for BBCode: Extra close tag, insufficient close tag, mismatched close tags (open tags are by default fine). Currently (in prod), extra close tags are ignored
//TODO: Perform multiple checks on misaligned tags and pick which one we want to go with based on heuristics
`
	let remainderCode = '[code]This is[/code] [hr] a [legend=goober][code]qwertyuiop'
	let root = new TreeNode()
	let currentNode = root
	
	while(remainderCode){
		;[currentNode, remainderCode] = currentNode.findNextNode(remainderCode)				//The node should save whatever BBCode it needs and returns whatever hasn't been processed, along with the next node responsible for it
	}
	
	console.log(root.parseTree())
`
//TODO Run this through the normal BBCode parser after full translation, and if it generates any errors with _that_ (after cleaning it with its own error handling), display a message to ask Legend to check the code

//TODO: Figure out why glow is killing my CPU? =/
//Maybe remove animation and just do the image of the text