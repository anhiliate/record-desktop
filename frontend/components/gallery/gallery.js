import React from 'react';

import ComponentGallery from 'react-component-gallery';
import GalleryFile from '../gallery-file/gallery-file';

import remote from 'remote';
import _ from 'lodash';

import { ipcRenderer } from 'electron';

import {
  COPY_TO_CLIPBOARD,
  OPEN_FILE,
  DELETE_FILE,
  UPLOAD,
  NEW_FILE
} from '../../../shared/constants';

import detectViewport from './detect-viewport';

export default React.createClass({
  getInitialState: () => ({ files: [] }),
  getFiles() {
    const { getFiles } = remote.require('../dist/utils');
    const { getFolder } = remote.require('../dist/config');

    getFiles(getFolder())
      .then(files => {
        this.setState({
          files: files.map((file, index) => ({
            ...file,
            visible: index < 10
          }))
        });
      })
      .catch(err => {
        console.log(err);
        new Notification('record-desktop', { body: err.stack });
      });
  },
  componentDidMount() {
    this.getFiles();

    const onPageScroll = () => {
      const visibility = detectViewport('.imageBlock');

      this.setState({
        files: this.state.files.map((file, index) => ({
          ...file,
          visible: visibility[index]
        }))
      });
    };

    ipcRenderer.on(NEW_FILE, () => this.getFiles());
    window.onscroll = _.debounce(onPageScroll, 50, { trailing: true });
  },
  componentWillUnmount() {
    window.onscroll = null;
    ipcRenderer.removeAllListeners(NEW_FILE);
  },
  onClickDelete(index) {
    const file = this.state.files[index];
    ipcRenderer.send(DELETE_FILE, file.url);

    this.setState({
      files: [
        ...this.state.files.slice(0, index),
        ...this.state.files.slice(index + 1)
      ]
    });
  },
  render() {
    return (
      <div>
        <ComponentGallery
          margin={10}
          widthHeightRatio={3/5}
          targetWidth={350}>
          {
            this.state.files.map((file, index) => (
              <GalleryFile key={file.url}
                           file={file}
                           upload={() => ipcRenderer.send(UPLOAD, file.url)}
                           copyToClipboard={() => ipcRenderer.send(COPY_TO_CLIPBOARD, file.url)}
                           onClickDelete={() => this.onClickDelete(index)}
                           openFile={() => ipcRenderer.send(OPEN_FILE, file.url)} />
            ))
          }
        </ComponentGallery>
      </div>
    );
  }
});
