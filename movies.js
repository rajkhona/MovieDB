var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var  schema = new Schema ({
    title : {type : String , required : true },
    actor : {type : Array , required : true },
    director : {type : String , required : true },
    genre: {type : String , required : true },
});

module.exports = mongoose.model('Movies', schema);  