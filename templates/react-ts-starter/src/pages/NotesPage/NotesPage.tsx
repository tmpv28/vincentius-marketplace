import React from "react";

import ManageNotesFeature from "../../features/Notes/ManageNotes/ManageNotesFeature";

import { NotesPageType } from "./modules/types";
import "./NotesPage.scss";

// Layout only. The page composes features; it never performs their work.
const NotesPage: React.FC<NotesPageType> = ({
  pageTitle = "Notes",
  pageSubtitle = "A single neutral entity, wired end to end through every layer of the standard."
}: NotesPageType) => {
  //-----------

  return (
    <main className="NotesPage">
      <div className="NotesPage__content">
        <header className="NotesPage__header">
          <h1 className="NotesPage__title">{pageTitle}</h1>

          <p className="NotesPage__subtitle">{pageSubtitle}</p>
        </header>

        <ManageNotesFeature />
      </div>
    </main>
  );
};

export default NotesPage;
