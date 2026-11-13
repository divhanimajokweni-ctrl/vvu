11/12/26, 8:47 PM 

Zookeeper: The Conversational CAD Agent For Parametric Modeling | Zoo 

Introduction: <mark>What</mark> is Zookeeper ~~?~~ 

Zookeeper is the conversational CAD agent built into Zoo Design Studio ~~.~~ Our goal in developing Zookeeper is to speed up CAD workflows, automate the toil in design work, and enable designers and engineers of all skill levels to more efficiently produce manufacturable, high ~~-q~~ uality 3D designs. 

Zoo Design Studio is our flagship 3D CAD application. It hosts a unique and flexible CAD workflow by enabling users to seamlessly switch between point ~~-~~ and ~~-c~~ lick modeling and defining and editing geometry and annotations as code. Zookeeper extends that hybrid workflow by introducing Al ~~-~~ assisted modeling ~~:~~ it can create new models, inspect existing projects, understand what is selected, answer questions, and perform design reviews. 

In this article, we will explore the development decisions behind Zookeeper and highlight the challenges in developing a system that automates the design of parametric, 3D boundary representation models ~~.~~ 

Background ~~:~~ Boundary Representation (B ~~-~~ Rep) for Engineering Applications Many people, particularly those from outside the physical engineering disciplines, associate the phrase "3D model" with a polygonal mesh ~~--~~ essentially, a collection of connected triangles. While meshes are well ~~-~~ suited to applications such as rendering and gaming, this representation scheme has limitations that make it a poor fit for CAD and design for manufacturing. Engineering workflows require the precision and edit ~~-a~~ bility provided by B ~~-~~ Reps ~~.~~ 

Circle & Sphere Representations 



<!-- Start of picture text -->
. . Co) . C) .<br><!-- End of picture text -->

https ~~:~~ //z0 ~~0~~ .dev/research/zookeeper 

115 

11/12/26, 8:47 PM 

Zookeeper: The Conversational CAD Agent For Parametric Modeling | Zoo 

There are three key characteristics of B ~~-~~ Rep that make it the preferred choice for CAD applications: 

- « Precision ~~:~~ B ~~-~~ Rep geometry represents surfaces exactly ~~—~~ curves are true curves, not approximations formed by tiny straight lines ~~.~~ This is critical for engineering applications where high precision is required ~~.~~ 

- e Editing ~~:~~ Need to adjust a fillet radius or resize a hole ~~?~~ With B ~~-~~ Rep, it's often as straightforward as updating a parameter ~~.~~ Modifying a mesh typically involves manipulating vertices directly, which can be complex and erro ~~r-~~ prone ~~.~~ 

- ¢ Workflow compatibility ~~:~~ B ~~-~~ Rep is the standard representation for many CAD and CAM tools ~~.~~ For tasks like running simulations or manufacturing a part, B ~~-~~ Rep data is generally preferred or required ~~.~~ 

In short, meshes are often sufficient for visuals, while B ~~-~~ Rep is designed for building real stuff ~~.~~ 

Research ~~:~~ <mark>Why</mark> is <mark>CAD</mark> hard to solve with Al 

Progress in Generative Al has accelerated rapidly across all domains in recent years ~~.~~ Before the popularity of the transformer architecture, early ML models from the mid ~~-~~ 2010s could generate rudimentary images via Variational Autoencoders (VAEs) and Generative Adversarial Networks (GANs), or could generate short snippets of text via Recurrent Neural Networks (RNNs) ~~.~~ 3D model generation lagged behind because it requires more compute to process the additional dimension, and because high ~~-q~~ uality annotated training data is harder to curate for 3D models, compared to images and text ~~.~~ Early notable examples of generative 3D modeling dealt with point cloud representations, as in PointFlow and Point ~~-~~ E. Later, generative mesh research would be published via DreamFusion and Magic3D ~~.~~ Finally, more recent works have been published to demonstrate direct B ~~-~~ Rep generation via transformers, as in DeepCAD, and via Graph Neural Networks (GNNs), as in BRepGen ~~.~~ 

But using Al to generate geometry is not enough to support the design of real, physical 3D objects. CAD modeling is an inten ~~t-~~ based workflow ~~.~~ Designers construct models feature ~~-~~ by ~~-~~ feature, by sketching profiles and extruding them into the third dimension, while defining constraints, dimensions and relationships between sketch segments and 3D bodies. A robust Al system for CAD must be able to generate a coherent design intent, and must be able to produce follo ~~w-~~ up edits to the design while preserving the intent. This is why most generative 3D research fails to lead to useful tools for working designers and engineers. 

Development ~~:~~ <mark>From</mark> Tex ~~t-~~ t ~~o~~ -CAD to Zookeeper 

https ~~:~~ //z0 ~~0~~ .dev/research/zookeeper 

215 

11/12/26, 8:47 PM 

Zookeeper: The Conversational CAD Agent For Parametric Modeling | Zoo 

Three years ago, when our team began researching and prototyping our own generative Al solution to complement our CAD engine and 3D modeling application, we initially pursued direct Tex ~~t-~~ t ~~o-B-~~ Rep generation methods similar to those cited above ~~.~~ Two developments ultimately inspired us to change course ~~:~~ First was the evolution of our firs ~~t-~~ class design language, KCL, as the definition of geometry and design intent in our modeling app. Second was the rising capability and popularity of Large Language Models (LLMs) in 2023 ~~.~~ We considered how LLMs were beginning to show accuracy in writing code, how easy it was to prototype and iterate with LLMs, and how LLMs were becoming increasingly widespread and capable at a rapid pace. 

This culminated in the release of our first Al product, Tex ~~t-~~ t ~~o-~~ CAD, in December 2023. Tex ~~t-~~ t ~~o~~ -CAD provided two simple endpoints ~~:~~ One for generating 3D B ~~-~~ Rep models via prompting, and one for editing existing models ~~.~~ Under the hood, Tex ~~t-~~ t ~~o~~ -CAD is actually an agentic Al program ~~--~~ more on that in the section below ~~--~~ and is directly integrated into Zoo's CAD engine to generate, modify and validate 3D geometries ~~.~~ 

As time went on, and conversational agents such as ChatGPT, Claude and Gemini gained popularity, we knew we wanted to evolve Tex ~~t-~~ t ~~o~~ -CAD into a more helpful Al assistant ~~--~~ one that could be communicated with in a conversational style, as if it were a human teammate, with more flexible modes of understanding and greater agency to reason about intent, take action across the modeling workflow, ask clarifying questions, and iteratively create, modify and validate designs in closer collaboration with the user ~~.~~ In January 2026, we shipped our conversational agent as "Zookeeper" with Zoo Design Studio v1 ~~.~~ 1 ~~.~~ 

# Implementation: <mark>What</mark> is an agent? 

In the context of Al, the most basic form of an agent is a Machine Learning model that can use tools in a loop. Typically, this loop looks like ~~<u>:</u>~~ Plan ~~-~~ > Act (call tools) ~~-~~ > Observe results ~~-~~ > Update the plan ~~-~~ > Repeat until done. Zookeeper is similar to other agentic programming tools such as Codex and Claude Code, in that it is powered by LLMs with strict context management. Zookeeper differentiates itself from other agents with additional tools for connecting to the Zoo CAD engine, writing, executing and debugging KCL, and analyzing 3D models via visual snapshots and computational tools for engineering, such as center of mass location, mass calculation, and surface area and volume measurements. Zookeeper is designed to behave like an engineer ~~:~~ It searches for and reads documentation as it works, it frequently executes the model to check for errors, and it reviews the geometry via mult ~~i-~~ view snapshots. 

We are constantly optimizing Zookeeper's toolbox, so for an up ~~-t~~ o ~~-~~ date description of its tools, you can prompt Zookeeper to list them ~~:~~ 

https ~~:~~ //z0 ~~0~~ .dev/research/zookeeper 

3/5 

11/12/26, 8:47 PM 

Zookeeper: The Conversational CAD Agent For Parametric Modeling | Zoo 



<!-- Start of picture text -->
What are your tools? { 7°<br><!-- End of picture text -->

See reasoning 

Here in Zoo Design Studio, | use a set of CAD- and KCL-focused tools to inspect, edit, execute, and review your active project: 

© Project inspection 

      - « list_project_files: see what's in the workspace. * read_file: open any .kcl or text file. e read_user_selections: read the faces/edges/features you've selected. « describe_snapshot_of_project: render snapshots from set views to understand current geometry. 

   - Modeling and editing 

      - write_kcl_file: create or overwrite KCL files. 

      - ¢ delete_kcl_file: remove files. * search_in_project: find text across project files. 

   - Docs and examples 

      - retrieve_kcl_code_examples: pull relevant KCL sample models. 

      - « list_all.docs and get_docs: browse and read KCL stdlib APIs. ¢ search_docs: search KCL documentation. 

   - « Execution and review 

      - mock_execute_project: quick syntax check without full engine run. 

      - * execute_project: run the model to generate geometry and catch runtime issues. * review_snapshot_of_project: check results against criteria from multiple camera views. 

   - © Cleanup/quality 

      - © lint_and_fix_project and format_project: auto-fix style and format KCL. 

   - Geometry properties 

- volume_of_project, surface_area_of_project, mass_of_project, center_of_mass_of_project: compute key physical properties (with appropriate units/density). 

- ae If you tell me what you'd like to change or build, I'll use these to update your model step by step. 

a Clear chat 



https ~~:~~ //z0 ~~0~~ .dev/research/zookeeper 

415 

11/12/26, 8:47 PM 

Zookeeper: The Conversational CAD Agent For Parametric Modeling | Zoo 

   - existing models and have them reconstructed into clean, editable KCL programs that can 

   - be inspected, modified, and extended like any native design ~~.~~ 

- « Fleets of agents ~~:~~ Manage a team of Zookeeper agents working concurrently ~~.~~ Agents can 

   - be assigned to work on different features, components or projects in parallel, or 

   - coordinate to complete a single task faster ~~.~~ 

Follow us for updates, or try <mark>Zoo</mark> Design Studio for free to get started with Zookeeper ~~.~~ 

https ~~:~~ //z0 ~~0~~ .dev/research/zookeeper 

5/5 

