A ES6 wrapper (co & generator based - async/await style) for node-postgres.


# Example
```
var pg  = require('pg-co');
var SQL = require('sql-template');

var conString = "postgres://postgres:1234@localhost/postgres";

var client = new pg(conString);

co(function*(){
  var line;
  line = yield client.row(SQL`SELECT * FROM users WHERE id=${22}`);
  // same line = yield client.row('users', {id:22});
  if(!line)
    throw "Missing user";

  yield client.insert("users_log", {
    user_id : 22,
    time    : Date.now(),
  });
});
```

# API

## await client.select(table [,condition = true [, columns = * [, extra ]]])
## await client.select(PG_TEMPLATED_QUERY)
  Select stuffs ? what did you expect ...

```
var line = yield client.select(SQL`SELECT * FROM users WHERE parentId=${22}`);
=> [ {id:1, name : "John doe", parentId:22}, {id:2, name : "Jane doe", parentId:22}]
```



## await client.row(table [,condition = true [, columns = * [, extra = LIMIT 1 ]]])
## await client.row(PG_TEMPLATED_QUERY)
  return a single row, and a falsy value if no match (see example below)

```
var line = yield client.row(SQL`SELECT * FROM users WHERE id=${22}`);
=> { id : 22, name : "John doe" }
```


## await client.col(table [,condition = true [, column = * [, extra = '']]])
## await client.col(PG_TEMPLATED_QUERY)
  return an array of values from a single column

```
var line = yield client.col('users', true, 'user_id');
=> [22, 1, 25, 55]
```


## await client.insert(table, values)
Insert values in table...

```
yield client.insert("users_log", {
  user_id : 22,
  time    : Date.now(),
});
```


## await client.update(table, values[, where])
Update values in a table...

```
yield client.insert("users_log", {
  time    : Date.now(),
}, {
  user_id : 22,
});
```


## await client.replace(table, values[, where])
Replace values in a table... (lock select using * postgresql FOR UPDATE)

```
yield client.replace("users_log", {
  time    : Date.now(),
}, {
  user_id : 22,
});
```

## await client.query(queryString);
```
yield client.query("TRUNCATE TABLE donttruncatemeplznooooo");
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
