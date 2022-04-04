"use strict";

const Pg        = require('pg');
const SQL       = require('sql-template');

const values    = require('mout/object/values');
const merge     = require('mout/object/merge');
const sprintf   = require('util').format;

const Event    = require('events').EventEmitter;

const debug     = require('debug')('pg-aa');

class PG extends Event {

  constructor(src, fromPool) {
    super();
    this.transactions_stack = {};

    this._lnk = null;
    this.pfx = {};
    this._isPooled = !!fromPool;
    this._src = src;
  }

  get lnk() {
    return this;
  }

  async connect() {
    if(this._lnk)
      return this._lnk;

    var lnk;

    if(this._isPooled) {

      lnk = await this._src.connect();
    } else {
      lnk =  new Pg.Client(this._src);
      /* istanbul ignore next */
      lnk.on('error', (err) => {  this.emit('error', err); });
      await new Promise(function(resolve, reject) {
        lnk.connect(function(err) {
          if(err)
            return reject(err);
          resolve();
        });
      });
    }

    this._lnk = lnk;
    lnk.on('notification', this.emit.bind(this, 'notification'));
    return lnk;
  }

  async query(query) {
    var lnk = await this.connect();
    debug(query.toString());
    var result = await lnk.query(query);
    return result;
  }

  async select(table /*, cond, cols*/) {
    var query = typeof table != "string" ? table : SQL.select(...arguments);
    var result = await this.query(query);
    return result.rows;
  }

  async value(table, cond, col) {
    var row = await this.row(...arguments);
    if(!row)
      return;

    var value = col && col in row ? row[col] : row[ Object.keys(row)[0] ];
    return value;
  }

  async row(/*table, cond, cols*/) {
    var rows = await this.select(...arguments);
    return rows[0];
  }

  async col(/*table, cond, col*/) {
    var rows = await this.select(...arguments);
    return rows.map(row => Object.entries(row)[0][1]);
  }

  async insert() {
    var query = SQL.insert(...arguments);
    return await this.query(query);
  }


  async insert_bulk(/*table, keys, values*/) {
    var query = SQL.insert_bulk(...arguments);
    return await this.query(query);
  }


  async truncate(table) {
    var query = SQL`TRUNCATE TABLE $id${table}`;
    return await this.query(query);
  }


  async delete(table, where) {
    var query = SQL`DELETE FROM $id${table} $where${where}`;
    return await this.query(query);
  }


  async update(table, values, where) {
    if(where === undefined)
      where = true;

    if(Object.keys(values).length == 0)
      return;
    var query = SQL`UPDATE $id${table} $set${values} $where${where}`;
    return await this.query(query);
  }

  async replace(table, values, where) {
    let row = await this.row(table, where, "*", "FOR UPDATE");
    if(row)
      await this.update(table, values, where);
    else
      await this.insert(table, merge({}, values, where));
  }

  get_transaction_level() {
    var depths = values(this.transactions_stack);
    var level = depths.length ? Math.max.apply(null, depths) + 1 : 0;
    return level;
  }

  async begin() {
    var transaction_hash = `_trans_${Math.random().toString(16).substr(2)}`;

    var level = this.get_transaction_level();

    this.transactions_stack[transaction_hash] = level;

    var query = `BEGIN`;
    if(level != 0)
      query = `SAVEPOINT ${transaction_hash}`;

    await this.query(query);
    return transaction_hash;
  }

  async commit(transaction_hash) {
    var level = this.transactions_stack[transaction_hash];

    if(level === undefined)
      throw `Incorrect transaction passed ${transaction_hash}`;

    delete this.transactions_stack[transaction_hash];
    var max_depth = this.get_transaction_level();

    if(max_depth > level)
      throw `Incorrect transaction level passed ${level} < ${max_depth}`;

    if(level == 0) {
      try {
        await this.query(`COMMIT`);
      } catch(err) {
        //re-instate transaction level so it can be rolledback
        this.transactions_stack[transaction_hash] = level;
        throw err;
      }
    }

    return true;
  }


  async rollback(transaction_hash) {
    var level = this.transactions_stack[transaction_hash];

    if(level === undefined)
      throw `Incorrect transaction passed ${transaction_hash}`;

    for(var tmp_hash in this.transactions_stack) {
      if(this.transactions_stack[tmp_hash] >= level)
        delete this.transactions_stack[tmp_hash];
    }

    var query = `ROLLBACK`;

    if(level > 0)
      query = `ROLLBACK TO SAVEPOINT ${transaction_hash}`;

    await this.query(query);
    return true;
  }


  close(closePool) {
    this.transactions_stack = {};

    if(this._lnk) {
      this._lnk.removeAllListeners('notification');
      (this._lnk[this._isPooled ? 'release' : 'end'])();
      this._lnk = null;
    }

    if(this._isPooled &&  closePool)
      return this._src.close();
  }

  static pooled(conString) {
    if(!PG.lnkCache)
      PG.lnkCache = {};

    var hash = sprintf("%s@%s/%s", conString.user, conString.host, conString.database);
    var pool = PG.lnkCache[hash];
    if(!pool) {
      pool = new Pg.Pool(conString);
      PG.lnkCache[hash] = pool;
      pool.close = function() {
        delete PG.lnkCache[hash];
        return pool.end();
      };
      /* istanbul ignore next */
      pool.on('error', (err) => {
        debug('error', err);
      });
    }

    return new PG(pool, true);
  }


}



module.exports = PG;
module.exports.SQL = SQL;
module.exports.transformers = SQL.transformers;

