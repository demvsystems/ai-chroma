
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useTheme, Button, Text, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, useDisclosure } from '@chakra-ui/react'
import { useParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { GetProjectAndProjectionSets, getProjectionsForProjectionSet, getDatapointsForProject } from './DataViewerApi'
import { ProjectionSet, Datapoint, ProjectionData } from './DataViewTypes'
import { getMostRecentCreatedAt, jsonifyDatapoints, buildFilters, applyAllFilters, insertProjectionsOntoDatapoints } from './DataViewerUtils';
import ExplorerContainer from '../Containers/ExplorerContainer';
import Header from './Header';
import FilterSidebar from './FilterSidebar';
import DataPanel from './DataPanel';
import ProjectionPlotter from './ProjectionPlotter';

// on page load
// 1. fetch all the data I need (1) available projection sets, (2) datapoints, (3) latest projection set
// 2. generate the list of available filters given the datapoint data
// 3. pass data

const DataViewer = () => {
  const theme = useTheme()
  let params = useParams();

  const projectId = parseInt(params.project_id!, 10)

  // core data state management for this and all subcomponents
  let [datapoints, setDatapoints] = useState<Datapoint[]>();
  let [projections, setProjections] = useState<ProjectionData>();
  let [filters, setFilters] = useState<any>();

  // UI state
  let [fetchError, setFetchError] = useState<boolean>(false);
  let [toolSelected, setToolSelected] = useState<any>('cursor');
  let [toolWhenShiftPressed, setToolWhenShiftPressed] = useState<any>(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  let [insertedProjections, setInsertedProjections] = useState<boolean>(false);
  let [plottedPoints, setPlottedPoints] = useState<any>();
  let [cursor, setCursor] = useState('select-cursor');
  let [selectedPoints, setSelectedPoints] = useState([]) // callback from regl-scatterplot
  let [unselectedPoints, setUnselectedPoints] = useState([]) // passed down to regl-scatterplot

  // Onload Fetch projects and projection sets
  const [result, reexecuteQuery] = useQuery({
    query: GetProjectAndProjectionSets,
    variables: { "filter": { "projectId": projectId }, "projectId": projectId }
  })
  const { data, fetching, error } = result;

  // once complete, fetch datapoints for the project, and the most recent set of projections
  useEffect(() => {
    if (result.data === undefined) return
    const latestProjectionSetId = parseInt(getMostRecentCreatedAt(result.data.projectionSets).id, 10)
    getProjectionsForProjectionSet(latestProjectionSetId, (projectionsResponse: any) => {
      setProjections(projectionsResponse)
    });
    getDatapointsForProject(projectId, (datapointsResponse: any) => {
      const unpackedDatapoints = jsonifyDatapoints(datapointsResponse.datapoints)
      setDatapoints(unpackedDatapoints)
      let builtFilters = buildFilters(unpackedDatapoints)
      setFilters(builtFilters)
    });
  }, [result]);

  // load projection into datapoints
  useEffect(() => {
    if ((datapoints !== undefined) && (projections !== undefined) && (insertedProjections == false)) {
      setDatapoints(insertProjectionsOntoDatapoints(datapoints, projections))
      setInsertedProjections(true)
    }
  }, [datapoints, projections])

  // reapply filters
  useEffect(() => {
    if (filters === undefined) return
    let newVisibleDatapoints: Datapoint[] = applyAllFilters(datapoints, filters)
    setDatapoints([...newVisibleDatapoints])
  }, [filters])

  function handleKeyDown(event: any) {
    if (event.keyCode === 16) { // SHIFT
      setToolSelected('lasso')
      setToolWhenShiftPressed(toolSelected)
    }
  }

  function handleKeyUp(event: any) {
    if (event.keyCode === 16) { // SHIFT
      if (toolWhenShiftPressed !== 'lasso') {
        setToolSelected(toolWhenShiftPressed)
        setToolWhenShiftPressed('')
      }
    }
  }

  // Topbar functions passed down
  function moveClicked() {
    setToolSelected('cursor')
    setCursor('select-cursor')
  }
  function lassoClicked() {
    setToolSelected('lasso')
    setCursor('crosshair')
  }

  // Callback functions that are fired by regl-scatterplot
  const selectHandler = ({ points: newSelectedPoints }) => {
    setUnselectedPoints([])
    setSelectedPoints(newSelectedPoints)
  }
  const deselectHandler = () => {
    setSelectedPoints([])
  };

  const loading = (datapoints == undefined)
  let datapointsToRender = (datapoints !== undefined) ? datapoints.filter(dp => dp.visible == true) : 0

  return (
    // tabIndex is required to fire event https://stackoverflow.com/questions/43503964/onkeydown-event-not-working-on-divs-in-react
    <div
      onKeyDown={(e) => handleKeyDown(e)}
      onKeyUp={(e) => handleKeyUp(e)}
      tabIndex={0}
    >
      <ExplorerContainer>
        <Header
          toolSelected={toolSelected}
          moveClicked={moveClicked}
          lassoClicked={lassoClicked}
        ></Header>
        <FilterSidebar
          showSkeleton={loading}
          filters={filters}
          setFilters={setFilters}
          numVisible={datapointsToRender.length}
          numTotal={datapoints?.length}
        ></FilterSidebar>
        <ProjectionPlotter
          datapoints={datapoints}
          cursor={cursor}
          filters={filters}
          toolSelected={toolSelected}
          showLoading={loading}
          insertedProjections={insertedProjections}
          selectHandler={selectHandler}
          deselectHandler={deselectHandler}
        />
        <DataPanel
          datapoints={datapoints}
          selectedPoints={selectedPoints}
        />
      </ExplorerContainer>

      <Modal isCentered isOpen={fetchError} closeOnOverlayClick={false} onClose={onClose} autoFocus={true} closeOnEsc={false}>
        <ModalOverlay
          bg='blackAlpha.300'
          backdropFilter='blur(2px)'
        />
        <ModalContent>
          <ModalHeader>Fetch error</ModalHeader>
          <ModalBody>
            <Text>Unable to retrieve embeddings from the backend.</Text>
            <Text>{ }</Text>
            <Button colorScheme={"messenger"} backgroundColor={theme.colors.ch_blue} onClick={reexecuteQuery} color="white" variant="solid" mr={3} my={3}>
              Retry
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default DataViewer