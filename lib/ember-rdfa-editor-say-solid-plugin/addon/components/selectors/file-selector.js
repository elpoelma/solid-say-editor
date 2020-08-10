import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { LDP, RDF, SP } from 'solid-addon/utils/namespaces';
import File from '../../models/file-managing/file';
import Folder from '../../models/file-managing/folder';
import rdflib from 'ember-rdflib';
/**
 * Component responsible for rendering a file-tree and fetching the files and folders found in a user's solid storage.
 *
 * @module editor-say-solid-plugin
 * @class FileListComponent
 * @extends Ember.Component
 */
export default class FileSelectorComponent extends Component {

    @service("model/store-communicator") storeCommunicator;
    @service profile;
    @tracked root;
    @tracked popup;
    @tracked selectedFolder;


    /**
   * Fetches a list of file and folders from a Solid-pod
   *
   * @method fetchFiles
   *
   * @public
   */
    @action
    async fetchFiles() {
        const storage = this.storeCommunicator.store.any(this.profile.me, SP("storage"));
        this.root = new Folder(storage, []);
        this.root.isLoading = true;
        this.root.children = await this.getFiles(storage);
        this.root.isLoading = false;
    }

    /**
     * Fetches a list of files found in a specific folder from a Solid-pod
     *
     * @method getFiles
     *
     * @param {NamedNode} folder The given folder
     * @param {Fetcher} fetcher rdflib.js-fetcher
     * @public
     */
    async getFiles(folder) {
        const fetcher = this.storeCommunicator.store.fetcher;
        let result = [];
        await fetcher.load(folder);
        let files = this.storeCommunicator.store.match(folder, LDP('contains'));
        if (files === undefined) {
            return [];
        }
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            const isFolder = this.storeCommunicator.store.match(file.object, RDF("type"), LDP("Container"));
            // let children = await this.getFiles(file.object, fetcher);
            if (isFolder.length > 0) {
                let folderObj = new Folder(file.object, []);
                result.push(folderObj);
            } else {
                let fileObj = new File(file.object);
                result.push(fileObj);
            }
        }
        return result;
    }

    /**
     * Inserts a rdf:seeAlso-link to a specific file in the editor
     *
     * @method insertSelectedFile
     *
     * @public
     */
    @action
    insertSelectedFile() {
        const html = `<a href="${this.args.selectedFile.path.value}" property="rdf:seeAlso">${this.args.selectedFile.name}</a>`;
        this.args.onClose(html);
    }

    @action
    close() {
        this.args.onClose('');
    }
    @action
    async onOpenFolder(folder) {
        if (!folder.hasLoaded) {
            folder.isLoading = true;
            let files = await this.getFiles(folder.node);
            folder.children = files;
            folder.isLoading = false;
            folder.hasLoaded = true;
        }
    }

    @action
    setSelectedFolder(folder) {
        this.selectedFolder = folder;
    }

    @action
    addFile(file) {
        let fileObj = new File(file);
        this.selectedFolder.hasLoaded = false;
        this.selectedFolder.addFile(fileObj);
    }
}