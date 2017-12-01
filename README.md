A ES7 wrapper for node-postgres.



[![Build Status](https://travis-ci.org/131/pg-co.svg?branch=master)](https://travis-ci.org/131/pg-co)
[![Coverage Status](https://coveralls.io/repos/github/131/pg-co/badge.svg?branch=master)](https://coveralls.io/github/131/pg-co?branch=master)
[![NPM version](https://img.shields.io/npm/v/pg-aa.svg)](https://www.npmjs.com/package/pg-aa)



# Example
```
var pg  = require('pg-aa');
var SQL = require('sql-template');

var conString = "postgres://postgres:1234@localhost/postgres";

var client = new pg(conString);

(async function(){
  var line;
  line = await client.row(SQL`SELECT * FROM users WHERE id=${22}`);
  // same line = await client.row('users', {id:22});
  if(!line)
    throw "Missing user";

  await client.insert("users_log", {
    user_id : 22,
    time    : Date.now(),
  });
})();
```

# API

## await client.select(table [,condition = true [, columns = * [, extra ]]])
## await client.select(PG_TEMPLATED_QUERY)
  Select stuffs ? what did you expect ...

```
var line = await client.select(SQL`SELECT * FROM users WHERE parentId=${22}`);
=> [ {id:1, name : "John doe", parentId:22}, {id:2, name : "Jane doe", parentId:22}]
```



## await client.row(table [,condition = true [, columns = * [, extra = LIMIT 1 ]]])
## await client.row(PG_TEMPLATED_QUERY)
  return a single row, and a falsy value if no match (see example below)

```
var line = await client.row(SQL`SELECT * FROM users WHERE id=${22}`);
=> { id : 22, name : "John doe" }
```


## await client.col(table [,condition = true [, column = * [, extra = '']]])
## await client.col(PG_TEMPLATED_QUERY)
  return an array of values from a single column

```
var line = await client.col('users', true, 'user_id');
=> [22, 1, 25, 55]
```


## await client.insert(table, values)
Insert values in table...

```
await client.insert("users_log", {
  user_id : 22,
  time    : Date.now(),
});
```


## await client.update(table, values[, where])
Update values in a table...

```
await client.insert("users_log", {
  time    : Date.now(),
}, {
  user_id : 22,
});
```


## await client.delete(table[, where])
Delete rows in a table...

```
await client.delete("users_log", "log_weight < 51");
```


## await client.replace(table, values[, where])
Replace values in a table... (lock select using * postgresql FOR UPDATE)

```
await client.replace("users_log", {
  time    : Date.now(),
}, {
  user_id : 22,
});
```




## await client.query(queryString);
```
await client.query("TRUNCATE TABLE donttruncatemeplznooooo");
```


## await client.truncate(tableName);
```
await client.truncate("donttruncatemeplznooooo");
```




## await client.begin() => transaction token
## await client.commit(transaction token)
## await client.rollback(transaction token)
Start/commit/rollback a transaction (or a savepoint, if nested)

```
var transaction_token = await client.begin();
if(Math.random() < 0.5)
  await client.commit(transaction_token);
else  await client.rollback(transaction_token);
```



# Recommended template string engine
* [sql-template](https://github.com/131/sql-template)

# Not invented here / key features
* Supported nested transaction (through savepoints)
* Sane API = sane implementation (whole lib is < 150 lines)


# Credits
* [131](https://github.com/131)

