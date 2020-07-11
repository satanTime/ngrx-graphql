# ngrx-graphql

[![npm version](https://badge.fury.io/js/ngrx-graphql.svg)](https://badge.fury.io/js/ngrx-graphql)
[![CircleCI](https://circleci.com/gh/satanTime/ngrx-graphql.svg?style=shield)](https://app.circleci.com/pipelines/github/satanTime/ngrx-graphql)
[![Coverage Status](https://coveralls.io/repos/github/satanTime/ngrx-graphql/badge.svg?branch=master)](https://coveralls.io/github/satanTime/ngrx-graphql?branch=master)

A helper library for convertion of selectors made by [ngrx-entity-relationship](https://www.npmjs.com/package/ngrx-entity-relationship) to a GraphQL query.

### Supports
- Angular 6 and `ngrx/store@6`
- Angular 7 and `ngrx/store@7`
- Angular 8 and `ngrx/store@8`
- Angular 9 and `ngrx/store@9`
- Angular 10 and `ngrx/store@10`

## Installation

To install the package execute the next command `npm install --save ngrx-graphql`.

The next step is to add needed augments for types. It will help with integration of `ngrx-graphql` into `ngrx-entity-relationship`.
For that add the next line in `src/main.ts`.
```typescript
import 'ngrx-graphql/augments';
```

## Usage

> Note: you should be familiar with [ngrx-entity-relationship](https://www.npmjs.com/package/ngrx-entity-relationship).

Imagine we have a selector:
```typescript
export const selectUser = rootEntity(
    selectUserState,
    relatedEntity(
        selectCompanyState,
        'companyId',
        'company',
        relatedEntity(
            selectAddressState,
            'addressId',
            'address',
        ),
    ),
);
```

And we want to get a GraphQL query like that:
```graphql
{
    user(id: "1") {
        id
        firstName
        lastName
        companyId
        company {
            id
            name
            addressId
            address {
                id
                street
                city
                country
            }
        }
    }
}
```

The only issue is that the selector doesn't know fields of the entities.
To solve this we need to define them manually as meta of every selector.

> Don't forget to include fields for the id detection.

```typescript
export const selectUser = rootEntity(
    selectUserState,
    {
        gqlFields: ['id', 'firstName', 'lastName'],
    },
    relatedEntity(
        selectCompanyState,
        'companyId',
        'company',
        {
            gqlFields: ['id', 'name'],
        },
        relatedEntity(
            selectAddressState,
            'addressId',
            'address',
            {
                gqlFields: ['id', 'street', 'city', 'country'],
            },
        ),
    ),
);
```

Profit, now we can use this selector to generate a GraphQL query via `toGraphQL` helper function.
```typescript
const allUsers = toGraphQL('users', selectUser); // works for arrays of entities
const userId1 = toGraphQL('user(id: "1")', selectUser); // works with parameters
const userId2 = toGraphQL('user', {id: '2'}, selectUser); // converts parameters
```
The result will be
```graphql
{
  users {
    id
    firstName
    lastName
    companyId
    company {
      id
      name
      addressId
      address {
        id
        street
        city
        country
      }
    }
  }
}
```
```graphql
{
  user(id: "1") {
    id
    # and all other fields with relationships.
  }
}
```
```graphql
{
  user(id: "2") {
    id
    # and all other fields with relationships.
  }
}
```
If we want we can combine them together to a single query
```typescript
const combined = toGraphQL(
    toGraphQL('all:users', selectUser),
    toGraphQL('u1:user(id: "1")', selectUser),
    toGraphQL('u2:user', {id: '2'}, selectUser),
);
```
will generate
```graphql
{
  all:users {
    id
    # ...
  }
  u1:user(id: "1") {
    id
    # ...
  }
  u2:user(id: "2") {
    id
    # ...
  }
}
```

### Usage with HttpClient

An example of a ngrx effect and `HttpClient`.
```typescript
@Injectable()
export class EntityEffects {
    @Effect()
    public readonly dataGraph$ = this.actions$.pipe(
        ofType(UserActionTypes.LOAD),
        switchMap(
            () => this.http.get<{data: {users: Array<User>}}>('http://localhost:3000/graphql', {
                params: {
                    // toGraphQL generates the query
                    query: toGraphQL('users', selectUser),
                }
            }).pipe(
                // reduces data, requires meta reducer from ngrx-entity-relationship.
                map(response => reduceGraph({
                    data: response.data.users,
                    selector: selectUser,
                })),
            ),
        ),
    );

    constructor(
        protected readonly actions$: Actions,
        protected readonly http: HttpClient,
    ) {
    }
}
```

### Usage with Apollo Service

An example of a ngrx effect and `Apollo` service.
```typescript
@Injectable()
export class EntityEffects {
    @Effect()
    public readonly dataGraph$ = this.actions$.pipe(
        ofType(UserActionTypes.LOAD),
        switchMap(
            () => this.apollo.query<{users: Array<User>}>({
                // toGraphQL generates the query
                query: gql(toGraphQL('users', selectUser)),
            }).pipe(
                // reduces data, requires meta reducer from ngrx-entity-relationship.
                map(response => reduceGraph({
                    data: response.data.users,
                    selector: selectUser,
                })),
            ),
        ),
    );

    constructor(
        protected readonly actions$: Actions,
        protected readonly apollo: Apollo,
    ) {
    }
}
```

### Subscriptions

Usage of `toGraphQL` isn't enough to generate a subscription query.
Here `toSubscription` solves the issue.

For example
```typescript
const query = toSubscription(toGraphQL('users', action.selector));
```
will generate
```graphql
subscription {
  users {
    id
    # ...
  }
}
```
With `Apollo` service it can be used like thath
```typescript
apollo.subscribe({
  query: gql(toSubscription(toGraphQL('users', action.selector))),
}).subscribe(update => {
  // magic is here.
});
```

### Mutations

Usage of `toGraphQL` isn't enough to generate a mutation query.
Here `toMutation` solves the issue.

For example
```typescript
const query = toMutation(toGraphQL('updateUser', {
  id: 'id1',
  data: {
    firstName: 'updatedFirstName',
    lastName: 'lastFirstName',
  }
}, action.selector));
```
will generate
```graphql
mutation {
  updateUser(
    id:"id1",
    data: {
      firstName:"updatedFirstName",
      lastName:"lastFirstName"
    }
  ) {
    id
    # and all other fields with relationships.
  }
}
```
With `Apollo` service it can be used like that
```typescript
apollo.mutate({
  mutation: gql(toMutation(toGraphQL('updateUser', {
    id: 'id1',
    data: {
      firstName: 'updatedFirstName',
      lastName: 'lastFirstName',
    }
  }, action.selector))),
}).subscribe(update => {
  // magic is here.
});
```

### Query

Usage of `toGraphQL` isn't enough to generate a query with variables.
Here `toQuery` solves the issue, but about that in the [Variables](#variables) section.

### Variables

All `toQuery`, `toSubscription` and `toMutation` support variables.
They can be passed as the first parameter.
`toGraphQL` supports `$` to define variables instead of values.

```typescript
apollo.mutate({
  // the same for toQuery and toSubscription too.
  mutation: gql(toMutation({
    // definition of variables and their types.
    data: 'UpdateUserInput!',
  }, toGraphQL('updateUser', {
    id: 'id1', // a normal parameter with its value.
    // under $ parameters and their variables can be defined.
    $: {
      data: '$data',
    },
  }, action.selector))),
  variables: {
    data: {
      firstName: 'updatedFirstName',
      lastName: 'lastFirstName',
    },
  },
}).subscribe(update => {
  // magic is here.
});
```
will generate
```graphql
mutation($data: UpdateUserInput!) {
  updateUser(
    id:"id1",
    data: $data
  ) {
    id
    # and all other fields with relationships.
  }
}
```
