"use strict";

const co     = require('co');
const sleep  = require('nyks/function/sleep');
const SQL    = require('sql-template');
const expect = require('expect.js');
const eachLimit = require('async-co/eachLimit');

const pg = require('../');




describe("Testing lnk pooling", function(){
  var credentials = require('./db.json').admin;

  this.timeout(200 * 1000);

  it("Should test basic API", function *(){
    var lnk = pg.pooled(credentials);

    var row = yield lnk.row(SQL`SELECT 42 AS answer`);
    expect(row).to.eql({answer:42});
    lnk.close();
  });


  it("Should support connexion stress", function * (){
    for(var a= 0;a<1000;a++) {
      let tmp = pg.pooled(credentials);
      let row = yield tmp.row(SQL`SELECT 42 AS answer`);
      expect(row).to.eql({answer:42});
      tmp.close();

    }
  });


  it("Should test basic API", function *(){
    var lnk = pg.pooled(credentials);

    try {
      var row = yield lnk.row(SQL`SELEC`);
      expect().fail("Should never be here");
    } catch(err) {
      expect(""+err).to.eql(`error: syntax error at or near "SELEC"`);
    } finally {
      lnk.close();
    }

  });


  it("Should force the pool closing", function * (){
    let tmp = pg.pooled(credentials);
    let row = yield tmp.row(SQL`SELECT 42 AS answer`);
    expect(row).to.eql({answer:42});
    var before = process._getActiveHandles().length, after;

    tmp.close();
    yield tmp.close(true);
    yield sleep(100);
    after = process._getActiveHandles().length;
    expect(before).to.be.greaterThan(after);



  });

  it("Should re-open the pool", function *(){
    var lnk = pg.pooled(credentials);

    var row = yield lnk.row(SQL`SELECT 42 AS answer`);
    expect(row).to.eql({answer:42});
    lnk.close();
  });






});