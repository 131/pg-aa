"use strict";

var pg        = require('pg');
var SQL       = require('sql-template');

var pluck     = require('mout/array/pluck');
var values    = require('mout/object/values');



class Pg {

  constructor() {
    this.transactions_stack = {};
  }

  * query(query) {
    var result = yield this.lnk.query.bind(this.lnk, query);
    return Promise.resolve(result.rows);
  }

  * select(table, cond, cols) {
    var query = SQL.select.apply(arguments);
    return yield this.query(query);
  }


  * row(table, cond, cols) {
    var rows = yield this.select.apply(arguments);
    return Promise.resolve(rows[0]);
  }

  * col(table, cond, col){
    var rows = yield this.select.apply(arguments);

    return Promise.resolve(pluck(rows, col));
  }

  * insert(lnk, table, values){
    return lnk.query(SQL`INSERT INTO $id${table} $insert${values}`);
  }


  * update(lnk, table, values, where){
    var query = SQL`UPDATE $id${table} $set${values} $where${where}`;
    return lnk.query(query);
  }

  
  private get_transaction_level() {
    var depths = values(this.transactions_stack);
    var level = depths.length ? Math.max.apply(null, depths ) + 1: 0;
    return level;
  }
  
  * begin(lnk) {
    var transaction_hash = `_trans_${Math.random().toString(16).substr(2)}`;

    var level = this.get_transaction_level();
    this.transactions_stack[transaction_hash] = level;

    var query = `BEGIN`;
    if(level != 0)
      query = `SAVEPOINT ${transaction_hash}`;

    yield this.query(query);
    return Promise.resolve(transaction_hash);
  }

  * commit(lnk, transaction_hash) {
    var level = this.transactions_stack[transaction_hash];

    if(level === undefined)
      throw `Incorrect transaction passed ${transaction_hash}`;

    delete this.transactions_stack[transaction_hash];
    var max_depth = get_transaction_level();

    if(max_depth > level)
      throw `Incorrect transaction level passed ${level} < ${max_depth}`;

    if(level == 0)
      yield lnk.query(`COMMIT`);
    return Promise.resolve(true);
  }


  * rollback(lnk, transaction_hash) {
    var level = this.transactions_stack[transaction_hash];

    if(level === undefined)
      throw `Incorrect transaction passed ${transaction_hash}`;

    for(var tmp_hash in this.transactions_stack)
      if(this.transactions_stack[tmp_hash] >= level)
        delete this.transactions_stack[tmp_hash];

    var query = `ROLLBACK`;

    if(level > 0)
      query = `ROLLBACK TO SAVEPOINT ${transaction_hash}`;

    yield lnk.query(query);
    return Promise.resolve(true);
  }




}