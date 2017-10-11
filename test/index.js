"use strict";

const co     = require('co');
const sleep  = require('nyks/async/sleep');
const SQL    = require('sql-template');
const expect = require('expect.js');

const pg = require('../');




describe("Testing basic functions call", function(){
    var credentials = require('./db.json').admin;


  this.timeout(20000);
  var lnk = new pg(credentials);


  it("Should test basic API", async function(){

    var row = await lnk.row(SQL`SELECT 42 AS answer`);
    expect(row).to.eql({answer:42});

    var rows = await lnk.select(SQL`SELECT  generate_series(1, 6) AS foo`);
    expect(rows).to.eql([{foo:1}, {foo:2}, {foo:3}, {foo:4}, {foo:5}, {foo:6}]);


    var foo = await lnk.value(SQL`SELECT  42 AS foo`);
    expect(foo).to.eql(42);


    var foo = await lnk.value(SQL`SELECT  42 AS foo WHERE FALSE`);
    expect(foo).to.be(undefined);


    var rows = await lnk.col(SQL`SELECT  generate_series(1, 6) AS foo`, null, 'foo');
    expect(rows).to.eql([1, 2, 3, 4, 5, 6]);

    await lnk.query(SQL`CREATE TEMP  TABLE tmpp (foo INTEGER)`);

    await lnk.insert("tmpp", {foo:42});
    await lnk.insert("tmpp", {foo:41});
    
    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([42, 41]);

    await lnk.update('tmpp', {foo:12});
    


    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([12, 12]);

    await lnk.replace('tmpp', {foo:11}, {foo:12});
    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([11, 11]);

    await lnk.delete('tmpp', true);
    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([]);

    await lnk.replace('tmpp', {foo:8}, {foo:8});
    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([8]);


      //should allow to replace nothing
    await lnk.replace('tmpp', {}, {foo:8});
    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([8]);


    await lnk.truncate('tmpp');
    var rows = await lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([]);


  });



  it("Should expose transparent .lnk redirection", async function(){
    expect(lnk).to.be(lnk.lnk);
  });

  it("Should test transactions", async function(){
    var value, token, token2;

    await lnk.query(SQL`CREATE TEMP  TABLE prices (price INTEGER)`);
    await lnk.insert('prices', {price:12});


    value = await lnk.value('prices', true, 'price');
    expect(value).to.eql(12);


    token = await lnk.begin();
      await lnk.update("prices", {"price":11}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(11);
    await lnk.commit(token);


    token = await lnk.begin();
      await lnk.update("prices", {"price":8}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(8);
    await lnk.rollback(token);

    value = await lnk.value('prices', true, 'price');
    expect(value).to.eql(11);


      // begin, begin, rollback, commit
    token = await lnk.begin();
      await lnk.update("prices", {"price":8}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(8);

      token2 = await lnk.begin();
        await lnk.update("prices", {"price":7}, true)
        value = await lnk.value('prices', true, 'price');
        expect(value).to.eql(7);
      await lnk.rollback(token2);

      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(8);

    await lnk.commit(token);

    value = await lnk.value('prices', true, 'price');
    expect(value).to.eql(8);



      // begin, begin, commit, commit
    token = await lnk.begin();
      await lnk.update("prices", {"price":8}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(8);

      token2 = await lnk.begin();
        await lnk.update("prices", {"price":7}, true)
        value = await lnk.value('prices', true, 'price');
        expect(value).to.eql(7);
      await lnk.commit(token2);

      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(7);

    await lnk.commit(token);

    value = await lnk.value('prices', true, 'price');
    expect(value).to.eql(7);


    token = await lnk.begin(); token2 = "nope";
      await lnk.update("prices", {"price":5}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(5);
      try {
        await lnk.commit(token2);
        expect(true).to.eql(false); //never here
      } catch(e){
        expect(e).to.be("Incorrect transaction passed nope");
      }

    await lnk.rollback(token);

    try {
      await lnk.rollback(token);
      expect(true).to.eql(false); //never here
    } catch(e){
      expect(""+e).to.match(/Incorrect transaction passed/);
    }

    //current is 7

      // begin1, begin2, rollback1
    token = await lnk.begin();
      await lnk.update("prices", {"price":12}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(12);

      token2 = await lnk.begin();
        await lnk.update("prices", {"price":13}, true)
        value = await lnk.value('prices', true, 'price');
        expect(value).to.eql(13);
    await lnk.rollback(token);


    value = await lnk.value('prices', true, 'price');
    expect(value).to.eql(7);


    expect(lnk.transactions_stack).to.eql({}); //reset


      // begin1, begin2, commit1
    token = await lnk.begin();
      await lnk.update("prices", {"price":12}, true)
      value = await lnk.value('prices', true, 'price');
      expect(value).to.eql(12);

      token2 = await lnk.begin();
        await lnk.update("prices", {"price":13}, true)
        value = await lnk.value('prices', true, 'price');
        expect(value).to.eql(13);

    try {
      await lnk.commit(token);
      expect(true).to.eql(false); //never here
    } catch(e){
      expect(""+e).to.match(/Incorrect transaction level/);
    }

    lnk.close();
    lnk.close();


        //re-connect automaticaly
    var value = await lnk.value(SQL`SELECT 42 AS answer`);
    expect(value).to.eql(value);

  });




  it("should rollback properly on invalid commit", async function (){

    await lnk.query(`CREATE TEMP TABLE users (user_id INTEGER)`);
    await lnk.query(`ALTER TABLE users 
        ADD CONSTRAINT uniqueUser UNIQUE(user_id)
        DEFERRABLE INITIALLY DEFERRED;`);

    try {
      var token = await lnk.begin();

      await lnk.insert('users', {user_id:12});
      await lnk.insert('users', {user_id:12});

      var rows = await lnk.select('users');
      expect(rows.length).to.eql(2);

      await lnk.commit(token);

     // throw "Should never be here";
    } catch(err) {
      expect(err.message).to.match(/duplicate key value violates unique constraint/);
      await lnk.rollback(token);
    }

    var rows = await lnk.select('users');
    expect(rows.length).to.eql(0);

    lnk.close();

  });



});