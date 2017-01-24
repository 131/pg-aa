"use strict";

const pg        = require('pg');
const SQL       = require('sql-template');

const pluck     = require('mout/array/pluck');
const values    = require('mout/object/values');
const merge     = require('mout/object/merge');
const sprintf   = require('util').format;

const Events    = require('eventemitter-co');

const debug     = require('debug')('pg-co');

class Pg extends Events {

  constructor(src, fromPool) {
    super();
    this.transactions_stack = {};

    this._lnk = null;
    this.pfx = {};
    this._isPooled = !!fromPool;
    this._src = src;
  }


  * connect() {
    if(this._lnk)
      return Promise.resolve(this._lnk);

    var lnk;

    if(this._isPooled) {
      lnk = yield this._src.connect();
    } else {
      lnk =  new pg.Client(this._src);
        /* istanbul ignore next */
      lnk.on('error', (err) => {  this.emit('error', err); });
      yield lnk.connect.bind(lnk);
    }

    this._lnk = lnk;
    return Promise.resolve(lnk);
  }

  * query(query) {
    var lnk = yield this.connect();
    debug(query.toString());
    var result = yield lnk.query.bind(lnk, query);
    return Promise.resolve(result);
  }

  * select(table, cond, cols) {
    var query = typeof table != "string" ? table : SQL.select.apply(null, arguments);
    var result = yield this.query(query);
    return Promise.resolve(result.rows);
  }

  * value(table, cond, col) {
    var row = yield this.row.apply(this, arguments);
    if(!row)
      return ; // Promise.resolve(false);

    var value = col && col in row ? row[col] : row[ Object.keys(row)[0] ]
    return Promise.resolve(value);
  }

  * row(table, cond, cols) {
    var rows = yield this.select.apply(this, arguments);
    return Promise.resolve(rows[0]);
  }

  * col(table, cond, col){
    var rows = yield this.select.apply(this, arguments);

    return Promise.resolve(pluck(rows, col));
  }

  * insert(table, values){
    var query = SQL`INSERT INTO $id${table} $values${values}`;
    return yield this.query(query);
  }


  * truncate(table){
    var query = SQL`TRUNCATE TABLE $id${table}`;
    return yield this.query(query);
  }


  * delete(table, where){
    var query = SQL`DELETE FROM $id${table} $where${where}`;
    return yield this.query(query);
  }


  * update(table, values, where){
    if(where === undefined)
      where = true;

    var query = SQL`UPDATE $id${table} $set${values} $where${where}`;
    return yield this.query(query);
  }

  * replace(table, values, where){
    let row = yield this.row(table, where, "*", "FOR UPDATE");
    if(row)
      yield this.update(table, values, where);
    else
      yield this.insert(table, merge({}, values, where))
  }

  get_transaction_level() {
    var depths = values(this.transactions_stack);
    var level = depths.length ? Math.max.apply(null, depths ) + 1: 0;
    return level;
  }
  
  * begin() {
    var transaction_hash = `_trans_${Math.random().toString(16).substr(2)}`;

    var level = this.get_transaction_level();

    this.transactions_stack[transaction_hash] = level;

    var query = `BEGIN`;
    if(level != 0)
      query = `SAVEPOINT ${transaction_hash}`;

    yield this.query(query);
    return Promise.resolve(transaction_hash);
  }

  * commit(transaction_hash) {
    var level = this.transactions_stack[transaction_hash];

    if(level === undefined)
      throw `Incorrect transaction passed ${transaction_hash}`;

    delete this.transactions_stack[transaction_hash];
    var max_depth = this.get_transaction_level();

    if(max_depth > level)
      throw `Incorrect transaction level passed ${level} < ${max_depth}`;

    if(level == 0) {
      try {
        yield this.query(`COMMIT`);
      } catch(err) {
          //re-instate transaction level so it can be rolledback
        this.transactions_stack[transaction_hash] = level;
        throw err;
      }
    }

    return Promise.resolve(true);
  }


  * rollback(transaction_hash) {
    var level = this.transactions_stack[transaction_hash];

    if(level === undefined)
      throw `Incorrect transaction passed ${transaction_hash}`;

    for(var tmp_hash in this.transactions_stack)
      if(this.transactions_stack[tmp_hash] >= level)
        delete this.transactions_stack[tmp_hash];

    var query = `ROLLBACK`;

    if(level > 0)
      query = `ROLLBACK TO SAVEPOINT ${transaction_hash}`;

    yield this.query(query);
    return Promise.resolve(true);
  }


  close() {
    this.transactions_stack = {};

    if(!this._lnk)
      return;
    (this._lnk[this._isPooled ? 'release' : 'end'])();
    this._lnk = null;
  }

  static pooled(conString) {
    if(!Pg.lnkCache)
      Pg.lnkCache = {};

    var hash = sprintf("%s@%s/%s", conString.user, conString.host, conString.database);
    var pool = Pg.lnkCache[hash];
    if(!pool) {
      pool = new pg.Pool(conString);
      Pg.lnkCache[hash] = pool;
        /* istanbul ignore next */
      pool.on('error', (err) => {
        debug('error', err);
      });
    }

    return new Pg(pool, true);
  }


}





module.exports = Pg;
module.exports.SQL = SQL;
module.exports.transformers = SQL.transformers;

