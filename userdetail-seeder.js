var User = require('./user');
var mongoose = require('mongoose');
const neo4j = require('neo4j-driver');

mongoose.connect("mongodb://localhost:27017/Movies", {
  useNewUrlParser: true,
  useUnifiedTopology : true
});
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('raj', '1234')); //neo4j connection
const session = driver.session();


var users = [
    new User({
        name : 'abhijain0408@gmail.com',
        genre : [
            { name: 'Drama' },
            { name: 'Sci-fi' },
            { name: 'Romantic' }
            ],
        email : 'abhijain0408@gmail.com',
        
        }),
        new User({
            name : 'rajkhona11@gmail.com',
            genre : [
                { name: 'Drama' },
                { name: 'Sci-fi' }                
                ],
            email : 'rajkhona11@gmail.com',            
            }),
            new User({
                name : 'rajkhona11@gmail.com',
                genre : [
                    { name: 'Drama' },
                    { name: 'Sci-fi' }                
                    ],
                email : 'rajkhona11@gmail.com',            
                }),
            new User({
            name : 'sam@gmail.com',
            genre : [
                { name: 'Drama' }
                ],
            email : 'sam@gmail.com',            
            }),                        
            new User({
                name : 'jhony@gmail.com',
                genre : [
                    { name: 'Action' }
                    ],
                email : 'jhony@gmail.com',            
                }),
            new User({
                name : 'nick@gmail.com',
                genre : [
                    { name: 'Comedy' }
                    ],
                email : 'nick@gmail.com',            
                }),
            new User({
                name : 'frank@gmail.com',
                genre : [
                    { name: 'Drama' }
                    ],
                email : 'frank@gmail.com',            
                }),
            new User({
                name : 'virat@gmail.com',
                genre : [
                    { name: 'Action' },
                    { name: 'Drama' }
                    ],
                email : 'virat@gmail.com',            
                }),
            new User({
                name : 'kim@gmail.com',
                genre : [
                    { name: 'Action' },
                    { name: 'Comedy' }
                    ],
                email : 'kim@gmail.com',            
                })                                     
];  



var done = 0;
for (var i = 0; i < users.length ; i++ ){
    username = users[i].email;
    genrelist = users[i].genre;
    users[i].save( function(err,resutl) {
        done++;
        // MERGE (u:us_name {name:$username}) on create u.email = $username return u
        session.run(' MERGE (u:us_name {name:$username}) on create set u.email = $username return u',{
            username: username
        })
            .then(function(result){
                // MATCH (u:us_name) where u.name = $username UNWIND $genrelist AS genre MERGE (g:genre {name:genre.name}) with u, g MERGE (u)-[:Prefers]-> (g)
                session.run('MATCH (u:us_name) where u.name = $username UNWIND $genrelist AS genre MERGE (g:genre {name:genre.name}) with u, g MERGE (u)-[:Prefers]-> (g)',{
                    username : username,
                    genrelist : genrelist
                })
                .then (function (result){
                    console.log("relationship created");
                })
                .catch(function(err){
                    console.log(err);
                })
            
            })
            .catch(function(err){
                console.log(err);
            })
        if (done === users.length) {
            exit();
        }
    });
}

function exit(){
    mongoose.disconnect();
}
