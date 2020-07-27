import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import rdflib from 'ember-rdflib';
import { LDP, RDF, SP } from 'solid-addon/utils/namespaces';
import File from '../utils/file-managing/file';
import Folder from '../utils/file-managing/folder';

export default class FileSelectorComponent extends Component {
  
    @service rdfaCommunicator;

    @service("solid-auth") auth;
    @service profile;

    @tracked files;

    @tracked isLoading = false;


    constructor() {
        super(...arguments);
        if (this.auth.webId) {
            this.fetchFiles();
        }
    }

    @action
    async fetchFiles() {
        this.isLoading = true;
        if (this.profile.me === null) {
            await this.profile.fetchProfileInfo();
        }
        const storage = this.rdfaCommunicator.store.any(this.profile.me, SP("storage"));
        this.files = await this.getFiles(storage, this.rdfaCommunicator.store.fetcher);
        this.isLoading = false;
    }

    async getFiles(folder, fetcher) {
        let result = [];
        await fetcher.load(folder);
        let files = this.rdfaCommunicator.store.match(folder, LDP('contains'));
        if (files === undefined) {
            return [];
        }
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            const isFolder = this.rdfaCommunicator.store.match(file.object, RDF("type"), LDP("Container"));
            let children = await this.getFiles(file.object, fetcher);
            if (isFolder.length > 0) {
                let folderObj = new Folder(file.object, children);
                result.push(folderObj);
            } else {
                let fileObj = new File(file.object);
                result.push(fileObj);
            }
        }
        return result;
    }

    @action
    async login() {
        await this.auth.ensureLogin();
        await this.rdfaCommunicator.fetchTypeIndexes(this.auth.webId);

        await this.fetchFiles();
    }

    @action
    insertSelectedFile(){
        const html = `<a href="${this.selectedFile.path}" property="rdf:seeAlso">${this.selectedFile.name}</a>`;
        this.args.onClose(html);
    }

    @action
    close(){
        this.args.onClose('');
    }
  }