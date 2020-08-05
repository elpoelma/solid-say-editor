import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import rdflib from 'ember-rdflib';
import Subject from '../models/statements/subject';


export default class ProfileService extends Service {
    @service("solid-auth") auth;
    @service rdfaCommunicator;
    @tracked madeChanges = false;

    @tracked me = null;

    /**
     * Fetches the profile of the solid user and loads the profile document in the 
     * local store. 
     * The user should've already been logged in on his solid.community data pod. 
     */
    async fetchProfileInfo(){
        const me = rdflib.sym(this.auth.webId);
        const fetcher = this.rdfaCommunicator.store.fetcher;
        await fetcher.load(me);
        this.me = new Subject(me.value);
        this.me =  me; 
    }



}
