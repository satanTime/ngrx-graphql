import {ENTITY_SELECTOR} from 'ngrx-entity-relationship';
import 'ngrx-graphql/augments';

const resolveGraphQL = (
    selector: ENTITY_SELECTOR,
    options: {
        include: Array<keyof any>;
        prefix: string;
        level: number;
    } = {
        include: [],
        prefix: '',
        level: 0,
    },
) => {
    const prefix = options.prefix ? options.prefix.repeat(options.level) : '';
    let query = '';
    const included: Array<string> = [];
    for (const relationship of selector.relationships) {
        if (typeof relationship.keyId !== 'string') {
            continue;
        }
        if (typeof relationship.keyValue !== 'string') {
            continue;
        }
        if (relationship.ngrxEntityRelationship === 'childrenEntities') {
            included.push(relationship.keyValue);
            query += `${prefix}${relationship.keyValue}`;
            query += `${prefix ? ' ' : ''}{${prefix ? '\n' : ''}${resolveGraphQL(relationship, {
                include: [relationship.keyId],
                prefix: options.prefix,
                level: options.level + 1,
            })}${prefix}}${prefix ? '\n' : ''}`;
        } else if (relationship.ngrxEntityRelationship === 'childEntity') {
            included.push(relationship.keyValue);
            query += `${prefix}${relationship.keyValue}`;
            query += `${prefix ? ' ' : ''}{${prefix ? '\n' : ''}${resolveGraphQL(relationship, {
                include: [relationship.keyId],
                prefix: options.prefix,
                level: options.level + 1,
            })}${prefix}}${prefix ? '\n' : ''}`;
        } else {
            included.push(relationship.keyId);
            included.push(relationship.keyValue);
            query += `${prefix}${relationship.keyId}`;
            query += `\n${prefix}${relationship.keyValue}`;
            query += `${prefix ? ' ' : ''}{${prefix ? '\n' : ''}${resolveGraphQL(relationship, {
                include: [],
                prefix: options.prefix,
                level: options.level + 1,
            })}${prefix}}${prefix ? '\n' : ''}`;
        }
    }
    for (const field of options.include) {
        if (typeof field !== 'string') {
            continue;
        }
        if (included.indexOf(field) !== -1) {
            continue;
        }
        query += `${prefix}${field}\n`;
    }
    const fields = selector.meta.gqlFields || [];
    for (const field of fields) {
        if (included.indexOf(field) !== -1) {
            continue;
        }
        query += `${prefix}${field}\n`;
    }
    return query;
};

export function toGraphQL(...queries: Array<string>): string;
export function toGraphQL(query: string, params: object, selector: ENTITY_SELECTOR): string;
export function toGraphQL(query: string, selector: ENTITY_SELECTOR): string;

export function toGraphQL(...queries: Array<any>): string {
    const prefix = '';
    let query = '';
    let selector: ENTITY_SELECTOR | undefined;
    let params: Record<string, any> | null | string | undefined;
    if (queries.length >= 2 && typeof queries[1] !== 'string') {
        if (queries[2] && typeof queries[2] !== 'string') {
            [query, params, selector] = queries;
        } else {
            [query, selector] = queries;
        }
    }

    const stringParams: Array<string> = [];
    if (typeof params === 'string') {
        stringParams.push(params);
    }
    if (typeof params === 'object' && params !== null) {
        for (const key of Object.keys(params)) {
            stringParams.push(`${key}:${prefix ? ' ' : ''}${JSON.stringify(params[key])}`);
        }
    }
    params = stringParams.length ? `(${stringParams.join(`,${prefix ? ' ' : ''}`)})` : '';

    if (selector) {
        return `{\n${prefix}${query}${params}${prefix ? ' ' : ''}{\n${resolveGraphQL(selector, {
            include: [],
            prefix: `${prefix}`,
            level: 2,
        })}${prefix}}\n}`;
    }
    const parts: Array<string> = [];
    for (let part of queries) {
        if (typeof part !== 'string') {
            continue;
        }
        part = part.trim();
        if (part.substr(0, 1) === '{' && part.substr(part.length - 1, 1) === '}') {
            part = part.substr(1, part.length - 2);
        }
        parts.push(part.trim());
    }

    return `{${parts.join('\n')}}`;
}
