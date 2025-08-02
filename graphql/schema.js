const {GraphQLScalarType} = require('graphql');
const fs = require('fs');
const OrderAzyk = require('./orderAzyk');

module.exports.getTypeDefs = () => {
    let types = '', queries = '', mutations = ''
    const gqlFiles = fs.readdirSync('./graphql');
    for(let i=0; i<gqlFiles.length; i++) {
        if(!['index.js', 'schema.js'].includes(gqlFiles[i])) {
            const path = `./${gqlFiles[i]}`;
            const gqlFile = require(path);
            if(gqlFile.type) {
                types += `${gqlFile.type}`
           }
            if(gqlFile.query) {
                queries += `${gqlFile.query}`
           }
            if(gqlFile.mutation) {
                mutations += `${gqlFile.mutation}`
           }
       }
   }
    if(mutations) mutations = `\ntype Mutation {${mutations}}`
    return `scalar Date
type Data {
    data: String
}
type Sort {
    name: String
    field: String
}
type Filter {
    name: String
    value: String
}
type Social {
    url: String
    image: String
}
type SubCategory {
    _id: String
}
type Subscription {
    ${OrderAzyk.subscription}
}${types}type Query {${queries}}${mutations}`
};

module.exports.getResolvers = () => {
    let resolverQueries = {}, resolverMutations = {}
    const gqlFiles = fs.readdirSync('./graphql');
    for(let i=0; i<gqlFiles.length; i++) {
        if(!['index.js', 'schema.js'].includes(gqlFiles[i])) {
            const path = `./${gqlFiles[i]}`;
            const gqlFile = require(path)
            if(gqlFile.resolvers) resolverQueries = {...resolverQueries, ...gqlFile.resolvers}
            if(gqlFile.resolversMutation) resolverMutations = {...resolverMutations, ...gqlFile.resolversMutation}
       }
   }
    if(Object.keys(resolverQueries).length) {
        resolverQueries = {
            Query: {
                ...resolverQueries
           }
       }
   }
    if(Object.keys(resolverMutations).length) {
        resolverMutations = {
            Mutation: {
                ...resolverMutations
           }
       }
   }
    return {
        Date: new GraphQLScalarType({
            name: 'Date',
            description: 'Date custom scalar type',
            parseValue(value) {
                return new Date(value); // value from the client
           },
            serialize(value) {
                return new Date(value).getTime();
           },
            parseLiteral(ast) {
                // eslint-disable-next-line no-undef
                if (ast.kind === Kind.INT) {
                    return new Date(ast.value)
               }
                return null;
           },
       }),
        ...resolverQueries,
        ...resolverMutations,
        Subscription: {
            ...OrderAzyk.resolversSubscription
       }
   }
};