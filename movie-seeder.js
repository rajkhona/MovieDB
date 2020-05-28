var Movie = require('./movies');
var mongoose = require('mongoose');
const neo4j = require('neo4j-driver');

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('raj', '1234')); //neo4j connection
const session = driver.session();



mongoose.connect("mongodb://localhost:27017/Movies", {
  useNewUrlParser: true,
  useUnifiedTopology : true
});


var movies = [
    new Movie({
        title : 'Avatar',
        actor : [
            { name: 'Sam Worthington' },
            { name: 'Zoe Saldana' }
            ],
        director : 'James Cameron',
        genre: 'Sci-fi',
        }),
    
            
    new Movie({
        title : 'The Shawshank Redemption',
        actor : [
            { name: 'Tim Robbins' },
            { name: 'Morgan Freeman' }
            ],
        director : 'Frank Derabont',
        genre: 'Drama',
        }), 
    new Movie({
        title : 'The Godfather',
        actor : [
            { name: 'Al Pacino' },
            { name: 'Marlon Brando' }
            ],
        director : 'Francis Ford Coppola',
        genre: 'Crime',
            }), 
    new Movie({
        title : 'The Dark Knight',
        actor : [
            { name: 'Christian Bale' },
            { name: 'Heath Ledger' }
            ],
        director : 'Christopher Nolan',
        genre: 'Action',
                }),
     new Movie({
        title : 'Pulp Fiction',
        actor : [
            { name: 'John Travolta' },
            { name: 'Uma Thurman' }
            ],
        director : 'Quentin Tarantino',
        genre: 'Drama',
                })
];      
var done = 0;
for (var i = 0; i < movies.length ; i++ ){
    title = movies[i].title;
    director = movies[i].director;
    genre = movies[i].genre;
    actorlist = movies[i].actor;
    movies[i].save( function(err,resutl) {
        done++;
        session.run('MERGE (m:movie{name:$title}) return m',{
            title: title
        })
            .then(function(result){
                session.run(' MERGE (g:genre { name : $genre}) WITH g MATCH (m:movie { name:$title}) WITH g , m MERGE (m)-[:Belong_To]->(g)',{
                    title : title,
                    genre : genre
                })
                .then (function (result){
                    session.run(' MERGE (d:director { name : $director}) WITH d MATCH (m:movie { name:$title}) WITH d , m MERGE (d)-[:Directed]->(m)',{
                        title : title,
                        director : director
                    })
                    .then (function (result){
                        session.run(' MATCH (m:movie) where m.name = $title UNWIND $actorlist AS actor MERGE (a:actor {name:actor.name}) with m, a MERGE (a)-[:Acted_In]->(m)',{
                            title : title,
                            actorlist : actorlist
                        })
                        .then (function (result){
                            console.log("record created");
                        })
                        .catch(function(err){
                            console.log(err);
                        })
                    })
                    .catch(function(err){
                        console.log(err);
                    })
                })
                .catch(function(err){
                    console.log(err);
                })
            
            })
            .catch(function(err){
                console.log(err);
            })
        if (done === movies.length) {
            exit();
        }
    });
}

function exit(){
    mongoose.disconnect();
}
