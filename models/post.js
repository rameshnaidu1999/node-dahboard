var mongoose = require('mongoose'); 

var postSchema = new mongoose.Schema({ 
	name: String, 
	desc: String,
	tags: String, 
	img: 
	{ 
		data: Buffer, 
		contentType: String 
	} 
}); 

//Image is a model which has a schema imageSchema 

module.exports = new mongoose.model('Post', postSchema); 