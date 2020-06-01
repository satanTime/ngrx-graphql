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

## Installation

First we need to install the package `npm install --save ngrx-graphql`.

Then we need to extend types. For that we need to add the next line in `src/main.ts`.
```typescript
import 'ngrx-graphql/augments';
```

## Usage

First of all you should be familiar with [ngrx-entity-relationship](https://www.npmjs.com/package/ngrx-entity-relationship).

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
  users {id} # all the things we need will be inside
}
```
```graphql
{
  user(id: "1") {id} # all the things we need will be inside
}
```
```graphql
{
  user(id: "2") {id} # all the things we need will be inside
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
  all:users {id} # all the things we need will be inside
  u1:user(id: "1") {id} # all the things we need will be inside
  u2:user(id: "2") {id} # all the things we need will be inside
}
```

## Where to use

You can use it in ngrx effects for example.
```typescript
@Injectable()
export class EntityEffects {
    @Effect()
    public readonly dataGraph$ = this.actions$.pipe(
        ofType(UserActionTypes.LOAD),
        switchMap(
            () => this.http.get<{data: {users: unknown}}>('http://localhost:3000/graphql', {
                params: {
                    query: toGraphQL('users', selectUser), // <- generates query
                }
            }).pipe(
                map(response => reduceGraph({ // <- reduces data
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
