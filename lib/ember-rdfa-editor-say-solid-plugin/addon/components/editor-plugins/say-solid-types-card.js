import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import TypesBlockHandler from '../../utils/block-handlers/types-block-handler';
import Graph from '../../models/statements/graph';
import Node from '../../models/statements/node';

/**
 * Card responsible for the fetching of subjects and predicates of specific types
 * This card consists of three different screens: a type-selection screen, a subject-selection screen and a predicate-selection screen
 *
 * @module editor-say-solid-plugin
 * @class SaySolidTypesCard
 * @extends Ember.Component
 */
export default class SaySolidTypesCard extends Component {

    // Keeps track of the selected type and its corresponding graph found in the type-indexes. Keeps also track of the selected subject
    @tracked selectedType = null;
    @tracked selectedGraph = null;
    @tracked selectedSubject = null;
    @service storeCommunicator;

    screens = {
        TYPES: "types",
        SUBJECTS: "subjects",
        PREDICATES: "predicates"
    };

    // the current rendered screen
    @tracked currentScreen = this.screens.TYPES;

    @action
    async onClose(rdfa) {
        TypesBlockHandler.handleClose(this.args.info, rdfa);
    }

    @action
    setSelectedType(type){
        this.selectedType = type;
        this.selectedGraph = this.storeCommunicator.getGraphByType(type);
    }

    @action
    setSelectedSubject(subject){
        this.selectedSubject = subject;
    }
}