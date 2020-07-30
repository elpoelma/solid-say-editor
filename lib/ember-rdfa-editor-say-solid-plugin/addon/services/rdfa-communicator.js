import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import rdflib from 'ember-rdflib';
import ForkableStore, { addGraphFor, delGraphFor } from 'solid-addon/utils/forking-store';
import { SOLID } from 'solid-addon/utils/namespaces';

const { Statement, Fetcher } = rdflib;
const RDFS = rdflib.Namespace("http://www.w3.org/2000/01/rdf-schema#")
const PROXY_URL = "https://proxy.linkeddatafragments.org/";
/**
 * Represents a communication service for the components to query 
 * the underlying forking store, which makes use of rdflib to access 
 * different datapods. 
 * @class
 * @public
 * @constructor
 */
export default class RdfaCommunicatorService extends Service {

    @service profile;
    store = null;
    privateTypeIndex = null;
    publicTypeIndex = null;

    @tracked
    insertCache = [];

    constructor() {
        super(...arguments);
        this.store = new ForkableStore();
        Fetcher.crossSiteProxyTemplate="https://proxy.linkeddatafragments.org/{uri}"
        this.fetcher = new Fetcher(this.store.graph);
    }

    /** 
     * Find the type of the `subject` in RDF domain.  
     *
     * @param {NamedNode} subject is a RDFnode from rdflib.
     * @param {Context[]} rdfa is a list containing say-editor's context statements {subject, predicate, object}.
     * @returns {NamedNode} a NamedNode representing the type of the given `subject`.
     */
    getType(subject, rdfa) {
        const typequad = rdfa.find(quad => {
            return quad.subject === subject.value && quad.predicate === "a";
        });
        if (typequad) {
            return rdflib.sym(typequad.object);
        }
    }


    /**
     * The graph of the given `type` will be searched inside 
     * the given `typeIndex` document. 
     * 
     * @param {NamedNode} type is a NamedNode representing the type as a uri. 
     * @param {NamedNode} typeIndex is a type index graph in which the graph of the given `type` will be searched.
     * @returns {NamedNode} representing the graph of the given `type` derived from the given `typeIndex` document or `undefined` if it can't be found.
     */
    getGraphByType_TypeIndex(type, typeIndex) {
        // Search for type registration in typeIndex
        if (type && typeIndex) {
            const subject = this.store.any(undefined, SOLID("forClass"), type, typeIndex);
            if (subject) {
                return this.store.any(subject, SOLID("instance"), undefined, typeIndex);
            }
        }
        return undefined;
    }


    /**
     * Returns a `NamedNode` representing the graph of the given `type` 
     * The graph will be searched in the `publicTypeIndex` and `privateTypeIndex`.
     * 
     * @param {NamedNode} type is a NamedNode representing the type as a uri. 
     * @returns {NamedNode} representing the graph of the given `type`.
     * @throws {Error} thrown if no graph linked to the gievn `type` is found. 
     */
    getGraphByType(type) {
        const graph = this.getGraphByType_TypeIndex(type, this.publicTypeIndex) || this.getGraphByType_TypeIndex(type, this.privateTypeIndex);

        if (graph) {
            return graph;
        } else {
            throw new Error("No graph linked to this type found");
        }
    }

    /**
     * `NamedNode` representing the graph is derived form the given `subject` of the 
     * given `type`. It will first search in the `publicTypeIndex` and the `privateTypeIndex` 
     * documents first to derive the graph. 
     * It fallback to calling the `subject.doc()` if it couldn't find the graph in the type indices documents. 
     * 
     * @param {NamedNode} subject is a NamedNode representing the subject fo the `type`.
     * @param {NamedNode} type is a NamedNode reprensenting the type of the `subject`.
     * @returns {NamedNode} representing the graph of the given `subject` of `type`. 
     */
    getGraph(subject, type) {
        return this.getGraphByType_TypeIndex(type, this.publicTypeIndex) || this.getGraphByType_TypeIndex(type, this.privateTypeIndex) || subject.doc();
    }



    /**
     * Generates a HTML span tag containing RDF attributes of the given 
     * predicate and object. 
     * 
     * @param {Object} predObj represents the predicate and the object both of type `NamedNode`.
     * @param {NamedNode} predObj.predicate 
     * @param {NamedNode} predObj.object 
     * @returns {String} a HTML span tag string with RDF attributes.
     */
    async generateRDFaTag({ predicate, object }) {
        const metadata = await this.fetchResourceMetaData(predicate);
        if (object.termType === "Literal") {
            return `<span property="${predicate.value}" title="${metadata[RDFS("comment").value]}"> ${object.value} </span>`;
        } else {
            return `<a property="${predicate.value}" href="${object.value}" title="${metadata[RDFS("comment").value]}"> ${object.value} </span>`;
        }
    }


    /**
     * Parses the given array list of `Statements` to HTML span tags describing the list of 
     * `Statements`. 
     * 
     * @param {Statement[]} quads an array containing statements of quads.
     * @returns {String} HTML span tag describing the given array of quad statements. 
     */
    async toRDFa(quads) {
        if (!quads) {
            return "";
        }
        let subject = quads[0].subject;
        let start = `<span about="${subject.value}">`;
        let stack = [start];
        for (let quad of quads) {

            let rdfaTag = await this.generateRDFaTag(quad);
            stack.push(rdfaTag);
        }

        stack.push("</span>");
        return stack.join("\n");
    }

    /**
     * Adds the given quad statement to the insert cache. 
     * 
     * @param {Statement} quad statement to add to the cache.
     * 
     */
    addQuadToCache(quad) {
        this.insertCache = this.insertCache.filter(ins =>
            !(ins.subject.equals(quad.subject) &&
                ins.predicate.equals(quad.predicate) &&
                ins.graph.equals(quad.graph))
        );

        this.insertCache.push(quad);
    }

    /**
     * 
     * Save say-editor's context RDF statements in the local forking store. 
     * The saving is done by keeping track of the state changes on the local store, through 
     * the use of `add` statements and `remove` statements. 
     * 
     * @param {EditorBlock} block A logical blob for which the content may have changed. A blob
     * either has a different semantic meaning, or is logically separated (eg: a separate list item). 
     * See say-editor's `block` definition.
     * @param {Context[]} rdfa a list of say-editor's context statements {subject, predicate, object}. 
     */
    fromRDFa(block, rdfa) {
        rdfa.forEach(quad => {
            if (quad.predicate !== "a" && quad.subject !== "#") {
                let subject = rdflib.sym(quad.subject);
                let graph = this.getGraph(subject, this.getType(subject, rdfa));
                const dels = this.store.match(subject, rdflib.sym(quad.predicate), undefined, graph);

                let newObject;
                if (quad.datatype === RDFS("Resource").value) {
                    let domNode = block.semanticNode.domNode;
                    if (domNode.hasAttribute("href")) {
                        domNode.setAttribute("href", block.text);
                    }
                    quad.object = block.text.trim();
                    newObject = rdflib.sym(quad.object);
                } else {
                    newObject = rdflib.literal(quad.object.trim());
                }

                const ins = [new Statement(subject, rdflib.sym(quad.predicate), newObject, graph)];
                if (!dels || dels[0].object.value.trim() !== quad.object.trim()) {
                    this.profile.madeChanges = true;
                    this.addQuadToCache(ins[0]);
                    this.store.addAll(ins)
                    if (dels) {
                        this.store.removeStatements(dels);
                    }
                }
            }
        });
    }



    /**
     * Fetches the quad statements from the forking store containing the given `subject` which has 
     * the given `attributes` or predicates.
     * 
     * @param {NamedNode} subject NamedNode representing the subject to be queried in the forking store.
     * @param {Object} attributes Object containing the predicate uri strings as key and predicate NamedNode as value. 
     * @param {NamedNode} graph NamedNode representing the graph in which the subject will be queried. 
     * @async
     * @returns {Promise<Statement[]>} a promise resolved with the resulting quad statements from the forking store. 
     */
    fetchTriples(subject, attributes, graph, options = {}) {
        return new Promise((resolve, reject) => {

            if (!graph) {
                graph = this.getGraph(subject);
            }

            this.fetcher.nowOrWhenFetched(graph, async (ok, body, xhr) => {
                if (ok) {
                    let result_quads = []

                    if (attributes) {
                        for (let attrib of Object.keys(attributes)) {
                            result_quads = result_quads.concat(this.store.match(subject, attributes[attrib], undefined, graph));
                        }
                    } else {
                        result_quads = this.store.match(subject, undefined, undefined, graph);
                    }

                    resolve(result_quads);
                } else {
                    console.log(body);
                    reject(new Error("Could not load quads"));
                    
                }

            });

        });
    }


    fetchRemoteQuads(subject, attributes, graph) {
        return new Promise((resolve, reject) => {
            this.fetchTriples(subject, attributes, graph).then(quads => {
                resolve(quads);
            }).catch(err => {
                resolve([]);
            })
        });
    }

    /**
     * Retrieves metadata of the resource. (ex. rdfs:label, rdfs:comment, dct:description etc....)
     * @param {NamedNode} resource NamedNode for which the metadata will be retrieved from its graph. 
     */
    async fetchResourceMetaData(resource) {


        let metaDatas = [RDFS("label"), RDFS("comment")];
        let attribObj = metaDatas.reduce((map, node) => {
            map[node.value] = node;
            return map
        }, {});


        let quads = await this.fetchRemoteQuads(resource, attribObj);

        return quads.reduce((map, quad) => {
            map[quad.predicate.value] = quad.object;
            return map;
        }, {});
    }

    /**
     * Fetches all the subjects in the given `graph`
     * @param {NamedNode} graph NamedNode representing the graph 
     * @returns {NamedNode[]} list of NamedNode containing the different subjects from the given `graph`
     */
    fetchSubjectsByGraph(graph) {
        return new Promise((resolve, reject) => {
            this.store.fetcher.nowOrWhenFetched(graph, (ok, body, xhr) => {
                if (ok) {
                    let quads = this.store.match(undefined, undefined, undefined, graph);
                    let subjects = new Set(quads.map(quad => quad.subject));
                    resolve(subjects);
                } else {
                    reject(new Error("Could not load subjects"))
                }
            })
        });
    }

    /**
     * Fetches the type indices from the given webID and store them locally in the forking store. 
     * @param {String} webId string representation of the user's solid webID. 
     */
    async fetchTypeIndexes(webId) {
        const me = rdflib.sym(webId);
        await this.store.load(me.doc());
        this.privateTypeIndex = this.store.any(me, SOLID("privateTypeIndex"), undefined, me.doc());
        this.publicTypeIndex = this.store.any(me, SOLID("publicTypeIndex"), undefined, me.doc());
        await this.store.load(this.privateTypeIndex);
        await this.store.load(this.publicTypeIndex);
    }


    /**
     * Fetches types defined in both public and private type indices. 
     * 
     * @returns {NamedNode} NamedNode representing the types 
     *                    defined in the public and private type indices. 
     */
    fetchTypes() {
        let publicTypeRegs = this.store.match(undefined, SOLID("forClass"), undefined, this.publicTypeIndex);
        let privateTypeRegs = this.store.match(undefined, SOLID("forClass"), undefined, this.privateTypeIndex);
        let typeRegs = publicTypeRegs.concat(privateTypeRegs);
        let types = typeRegs.map(typeReg => typeReg.object);
        return types;
    }




    /**
     * Resets the graph from the local store by reloading the data from the 
     * web store. Helper method using the store's fetcher directly.
     * 
     * @param {NamedNode} graph a graph for which the forking store needs to reset. 
     */
    fetcherReset(graph) {
        this.store.fetcher.unload(addGraphFor(graph));
        this.store.fetcher.unload(delGraphFor(graph));
    }

    /**
     * Reset the local store by going through graphs in the insert cache. The insert cache contains emphemeral 
     * statements which still hasn't been persisted yet.  
     * 
     * @returns {Statement[]} a list of quads in the insert cache before the reset. 
     */
    reset() {
        let graphs = this.insertCache.map(quad => this.getGraph(quad.subject));
        let cache = this.insertCache;
        for (let graph of graphs) {
            this.fetcherReset(graph);
        }
        return cache;
    }

    /**
     * Persists the changes from the local store to the web store. 
     */
    persist() {
        this.store.persist();
    }


}
