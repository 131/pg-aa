"use strict";

var co = require('co');
var SQL = require('sql-template');
var expect = require('expect.js');

var pg = require('../');


describe("Testing basic functions call", function(){

  this.timeout(20000);
  var lnk = new pg({
    host:'127.0.0.1',
    user:'postgres',
    database:'postgres',
  });


  it("Should create a database", co.wrap(function *(done){


    var row = yield lnk.row(SQL`SELECT 42 AS answer`);
    expect(row).to.eql({answer:42});

    var rows = yield lnk.select(SQL`SELECT  generate_series(1, 6) AS foo`);
    expect(rows).to.eql([{foo:1}, {foo:2}, {foo:3}, {foo:4}, {foo:5}, {foo:6}]);


    var foo = yield lnk.value(SQL`SELECT  42 AS foo`);
    expect(foo).to.eql(42);


    var foo = yield lnk.value(SQL`SELECT  42 AS foo WHERE FALSE`);
    expect(foo).to.be(undefined);


    var rows = yield lnk.col(SQL`SELECT  generate_series(1, 6) AS foo`, null, 'foo');
    expect(rows).to.eql([1, 2, 3, 4, 5, 6]);

    yield lnk.query(SQL`CREATE TEMP  TABLE tmpp (foo INTEGER)`);

    yield lnk.insert("tmpp", {foo:42});
    yield lnk.insert("tmpp", {foo:41});
    
    var rows = yield lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([42, 41]);

    yield lnk.update('tmpp', {foo:12});
    
    var rows = yield lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([12, 12]);

    yield lnk.replace('tmpp', {foo:11}, {foo:12});
    var rows = yield lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([11, 11]);

    yield lnk.delete('tmpp', true);
    var rows = yield lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([]);

    yield lnk.replace('tmpp', {foo:8}, {foo:8});
    var rows = yield lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([8]);

    yield lnk.truncate('tmpp');
    var rows = yield lnk.col('tmpp', true, 'foo');
    expect(rows).to.eql([]);

  }));


  it("Should test transactions", co.wrap(function *(done){
    var value, token, token2;

    yield lnk.query(SQL`CREATE TEMP  TABLE prices (price INTEGER)`);
    yield lnk.insert('prices', {price:12});


    value = yield lnk.value('prices', true, 'price');
    expect(value).to.eql(12);


    token = yield lnk.begin();
      yield lnk.update("prices", {"price":11}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(11);
    yield lnk.commit(token);


    token = yield lnk.begin();
      yield lnk.update("prices", {"price":8}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(8);
    yield lnk.rollback(token);

    value = yield lnk.value('prices', true, 'price');
    expect(value).to.eql(11);


      // begin, begin, rollback, commit
    token = yield lnk.begin();
      yield lnk.update("prices", {"price":8}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(8);

      token2 = yield lnk.begin();
        yield lnk.update("prices", {"price":7}, true)
        value = yield lnk.value('prices', true, 'price');
        expect(value).to.eql(7);
      yield lnk.rollback(token2);

      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(8);

    yield lnk.commit(token);

    value = yield lnk.value('prices', true, 'price');
    expect(value).to.eql(8);



      // begin, begin, commit, commit
    token = yield lnk.begin();
      yield lnk.update("prices", {"price":8}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(8);

      token2 = yield lnk.begin();
        yield lnk.update("prices", {"price":7}, true)
        value = yield lnk.value('prices', true, 'price');
        expect(value).to.eql(7);
      yield lnk.commit(token2);

      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(7);

    yield lnk.commit(token);

    value = yield lnk.value('prices', true, 'price');
    expect(value).to.eql(7);


    token = yield lnk.begin(); token2 = "nope";
      yield lnk.update("prices", {"price":5}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(5);
      try {
        yield lnk.commit(token2);
        expect(true).to.eql(false); //never here
      } catch(e){
        expect(e).to.be("Incorrect transaction passed nope");
      }

    yield lnk.rollback(token);

    try {
      yield lnk.rollback(token);
      expect(true).to.eql(false); //never here
    } catch(e){
      expect(""+e).to.match(/Incorrect transaction passed/);
    }

    //current is 7

      // begin1, begin2, rollback1
    token = yield lnk.begin();
      yield lnk.update("prices", {"price":12}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(12);

      token2 = yield lnk.begin();
        yield lnk.update("prices", {"price":13}, true)
        value = yield lnk.value('prices', true, 'price');
        expect(value).to.eql(13);
    yield lnk.rollback(token);


    value = yield lnk.value('prices', true, 'price');
    expect(value).to.eql(7);


    expect(lnk.transactions_stack).to.eql({}); //reset


      // begin1, begin2, commit1
    token = yield lnk.begin();
      yield lnk.update("prices", {"price":12}, true)
      value = yield lnk.value('prices', true, 'price');
      expect(value).to.eql(12);

      token2 = yield lnk.begin();
        yield lnk.update("prices", {"price":13}, true)
        value = yield lnk.value('prices', true, 'price');
        expect(value).to.eql(13);

    try {
      yield lnk.commit(token);
      expect(true).to.eql(false); //never here
    } catch(e){
      expect(""+e).to.match(/Incorrect transaction level/);
    }

    lnk.close();
    lnk.close();



  }));



});