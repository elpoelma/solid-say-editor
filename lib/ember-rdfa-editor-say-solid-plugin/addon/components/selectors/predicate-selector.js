import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import rdflib from 'ember-rdflib';
import Predicate from '../../utils/predicate';
const RDFS = rdflib.Namespace("http://www.w3.org/2000/01/rdf-schema#")

/**
 * Component responsible for rendering a list of selectable predicates and for fetching predicates from a store for a specific subject
 *
 * @module editor-say-solid-plugin
 * @class PredicateSelectorComponent
 * @extends Ember.Component
 */
export default class PredicateSelectorComponent extends Component {
  @service rdfaCommunicator;
  @service profile;

  checkedAttributes = {};


  @tracked
  attributes = new Set();

   /**
   * Fetches a list of predicates from the store for the given subject
   *
   * @method resetAttributes
   *
   * @public
   */
  @action
  async resetAttributes() {
    let predicates = await this.rdfaCommunicator.fetchTriples(this.args.subject, undefined, this.args.graph);
    predicates = predicates.map(triple => triple.predicate);
    let predicateObjs = new Set();
    for (const predicate of predicates) {
      const metadata = await this.rdfaCommunicator.fetchResourceMetaData(predicate);
      let predicateObj = new Predicate(predicate, metadata[RDFS("label").value], metadata[RDFS("comment").value]);
      predicateObjs.add(predicateObj);
    }
    this.attributes = predicateObjs;
  }
  
  /**
   * Generates and inserts rdfa-tags for the selected predicates for the given subject
   *
   * @method insert
   *
   * @public
   */
  @action
  async insert() {
    const triples = await this.rdfaCommunicator.fetchTriples(this.args.subject, this.checkedAttributes, this.args.graph); 

    const rdfa = await this.rdfaCommunicator.toRDFa(triples);
    this.args.onClose(rdfa);
  }

  @action
  onSelect(pred) {
    if (this.checkedAttributes.hasOwnProperty(pred.node.value)) {
      delete this.checkedAttributes[pred.node.value]; 
    } else {
      this.checkedAttributes[pred.node.value] = pred.node;
    }
  }
}